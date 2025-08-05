// src/domain/entities/workflow-execution.ts
// ENTIDAD DE DOMINIO PURA - Sin dependencias de frameworks

export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  STOPPED = 'stopped',
}

export class WorkflowExecutionId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('WorkflowExecutionId cannot be empty');
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkflowExecutionId): boolean {
    return this.value === other.value;
  }

  static generate(): WorkflowExecutionId {
    // Usar crypto.randomUUID() si está disponible, sino usar Date.now()
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new WorkflowExecutionId(id);
  }
}

export class WorkflowExecution {
  private constructor(
    private readonly _id: WorkflowExecutionId,
    private readonly _workflowId: string,
    private readonly _jobId: string,
    private _status: WorkflowExecutionStatus,
    private _inputData: any,
    private _outputData: any,
    private _error: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _completedAt: Date | null,
  ) {}

  // Factory method para crear nueva ejecución
  static create(
    workflowId: string,
    jobId: string,
    inputData: any,
  ): WorkflowExecution {
    return new WorkflowExecution(
      WorkflowExecutionId.generate(),
      workflowId,
      jobId,
      WorkflowExecutionStatus.PENDING,
      inputData,
      null,
      null,
      new Date(),
      new Date(),
      null,
    );
  }

  // Factory method para reconstituir desde persistencia
  static reconstitute(data: {
    id: string;
    workflowId: string;
    jobId: string;
    status: WorkflowExecutionStatus;
    inputData: any;
    outputData: any;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): WorkflowExecution {
    return new WorkflowExecution(
      new WorkflowExecutionId(data.id),
      data.workflowId,
      data.jobId,
      data.status,
      data.inputData,
      data.outputData,
      data.error,
      data.createdAt,
      data.updatedAt,
      data.completedAt,
    );
  }

  // Getters inmutables
  get id(): WorkflowExecutionId {
    return this._id;
  }

  get workflowId(): string {
    return this._workflowId;
  }

  get jobId(): string {
    return this._jobId;
  }

  get status(): WorkflowExecutionStatus {
    return this._status;
  }

  get inputData(): any {
    return this._inputData ? { ...this._inputData } : null;
  }

  get outputData(): any {
    return this._outputData ? { ...this._outputData } : null;
  }

  get error(): string | null {
    return this._error;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  get completedAt(): Date | null {
    return this._completedAt ? new Date(this._completedAt) : null;
  }

  // Métodos de negocio
  start(): void {
    if (this._status !== WorkflowExecutionStatus.PENDING) {
      throw new Error(`Cannot start execution in status ${this._status}`);
    }
    this._status = WorkflowExecutionStatus.RUNNING;
    this._updatedAt = new Date();
  }

  updateProgress(outputData: any): void {
    if (this._status !== WorkflowExecutionStatus.RUNNING) {
      throw new Error(`Cannot update progress in status ${this._status}`);
    }
    this._outputData = { ...this._outputData, ...outputData };
    this._updatedAt = new Date();
  }

  complete(finalOutput: any): void {
    if (this._status !== WorkflowExecutionStatus.RUNNING) {
      throw new Error(`Cannot complete execution in status ${this._status}`);
    }
    this._status = WorkflowExecutionStatus.COMPLETED;
    this._outputData = finalOutput;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  fail(error: string): void {
    if (this._status === WorkflowExecutionStatus.COMPLETED) {
      throw new Error('Cannot fail a completed execution');
    }
    this._status = WorkflowExecutionStatus.FAILED;
    this._error = error;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (
      this._status === WorkflowExecutionStatus.COMPLETED ||
      this._status === WorkflowExecutionStatus.FAILED
    ) {
      throw new Error(`Cannot cancel execution in status ${this._status}`);
    }
    this._status = WorkflowExecutionStatus.CANCELLED;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  stop(reason: string): void {
    if (this._status !== WorkflowExecutionStatus.RUNNING) {
      throw new Error(`Cannot stop execution in status ${this._status}`);
    }
    this._status = WorkflowExecutionStatus.STOPPED;
    this._error = reason;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  isActive(): boolean {
    return (
      this._status === WorkflowExecutionStatus.RUNNING ||
      this._status === WorkflowExecutionStatus.PENDING
    );
  }

  isCompleted(): boolean {
    return (
      this._status === WorkflowExecutionStatus.COMPLETED ||
      this._status === WorkflowExecutionStatus.FAILED ||
      this._status === WorkflowExecutionStatus.CANCELLED ||
      this._status === WorkflowExecutionStatus.STOPPED
    );
  }

  // Para serialización
  toPlainObject(): any {
    return {
      id: this._id.toString(),
      workflowId: this._workflowId,
      jobId: this._jobId,
      status: this._status,
      inputData: this._inputData,
      outputData: this._outputData,
      error: this._error,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      completedAt: this._completedAt,
    };
  }
}
