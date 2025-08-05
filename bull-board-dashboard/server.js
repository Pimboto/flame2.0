const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
const port = process.env.BULL_BOARD_PORT || 3001;

// Redis connection - using the same config as your main app
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

// Create Bull Board server adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Function to get all queue names from Redis
async function getAllQueueNames() {
  try {
    // Get all keys that match BullMQ queue patterns
    const keys = await redis.keys('bull:*:id');
    const queueNames = [...new Set(keys.map(key => {
      // Extract queue name from key pattern: bull:queueName:id
      const match = key.match(/^bull:(.+):id$/);
      return match ? match[1] : null;
    }).filter(Boolean))];
    
    return queueNames;
  } catch (error) {
    console.error('Error getting queue names from Redis:', error);
    return [];
  }
}

// Function to create queue adapters
function createQueueAdapter(queueName) {
  try {
    const queue = new Queue(queueName, { connection: redis });
    
    // Determine description based on queue name
    let description = 'Queue';
    if (queueName.includes('-')) {
      const parts = queueName.split('-');
      if (parts.length >= 2) {
        const workflowName = parts.slice(0, -1).join('-');
        const stepName = parts[parts.length - 1];
        description = `${workflowName} - ${stepName} step`;
      }
    }
    
    return new BullMQAdapter(queue, { 
      readOnlyMode: false,
      allowRetries: true,
      description: description
    });
  } catch (error) {
    console.log(`Error creating adapter for queue ${queueName}:`, error.message);
    return null;
  }
}

// Create queues to monitor dynamically
let queues = [];

// Initialize queues on startup
async function initializeQueues() {
  console.log('🔍 Discovering queues in Redis...');
  const queueNames = await getAllQueueNames();
  
  if (queueNames.length === 0) {
    console.log('⚠️  No queues found in Redis. Make sure your application is running and has created some queues.');
  } else {
    console.log(`📋 Found ${queueNames.length} queue(s):`, queueNames);
  }
  
  queues = queueNames
    .map(queueName => createQueueAdapter(queueName))
    .filter(adapter => adapter !== null);
  
  console.log(`✅ Created ${queues.length} queue adapter(s)`);
  
  // Recreate Bull Board with new queues
  createBullBoard({
    queues,
    serverAdapter,
  });
}

// Initialize queues on startup
initializeQueues();

// Auto-refresh queues every 30 seconds to detect new queues
setInterval(async () => {
  try {
    const currentQueueNames = await getAllQueueNames();
    const currentQueueCount = queues.length;
    
    // Only refresh if the number of queues has changed
    if (currentQueueNames.length !== currentQueueCount) {
      console.log(`🔄 Auto-refresh: Found ${currentQueueNames.length} queues (was ${currentQueueCount})`);
      await initializeQueues();
    }
  } catch (error) {
    console.error('Error in auto-refresh:', error);
  }
}, 30000); // 30 seconds

// Create Bull Board
createBullBoard({
  queues,
  serverAdapter,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    redis: redisUrl,
    queues: queues.length
  });
});

// Refresh queues endpoint
app.post('/refresh-queues', async (req, res) => {
  try {
    console.log('🔄 Manual queue refresh requested...');
    await initializeQueues();
    res.json({ 
      success: true, 
      message: 'Queues refreshed successfully',
      queues: queues.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing queues:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get current queues info
app.get('/queues-info', async (req, res) => {
  try {
    const queueNames = await getAllQueueNames();
    res.json({
      totalQueues: queueNames.length,
      queues: queueNames,
      activeAdapters: queues.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mount Bull Board
app.use('/admin/queues', serverAdapter.getRouter());

// Root redirect to Bull Board
app.get('/', (req, res) => {
  res.redirect('/admin/queues');
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Bull Board Dashboard running on http://localhost:${port}`);
  console.log(`📊 Dashboard available at http://localhost:${port}/admin/queues`);
  console.log(`🔗 Redis URL: ${redisUrl}`);
  console.log(`🔄 Auto-refresh enabled every 30 seconds`);
  console.log(`📋 Endpoints:`);
  console.log(`   - Health check: http://localhost:${port}/health`);
  console.log(`   - Queue info: http://localhost:${port}/queues-info`);
  console.log(`   - Refresh queues: POST http://localhost:${port}/refresh-queues`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  redis.disconnect();
  process.exit(0);
}); 
