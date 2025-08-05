// Ejemplo con múltiples cuentas
const accounts = [
  {
    "udid": "00008101-001654DE2151003A",
    "deviceName": "2",
    "timestamp": "04/08/2025, 10:39:12",
    "authToken": "8e0c2d96-38d2-4756-9531-60641e3f02a6",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.MTMxODU0MTAzNjg.HskbTT3H4Hvz0bkEdvsIlNwl3ltRYSqYBlZOzeufHeY",
    "devicePersistentId": "ae54f3e7f9fb40b99e2ff2e7d94cc3e4",
    "deviceId": "4A24368E-503E-4971-AE6A-10018BB6D7E5",
    "latitude": "40.71272659301758",
    "longitude": "-74.00601196289062",
    "proxy": "gate.nodemaven.com:1080:ricky_ikonicmgmt_com-country-us-region-new_york-city-new_york_city-isp-verizon_g_home_internet-type-mobile-sid-8464001866262-ttl-24h-filter-high:3h1kpejl8d",
    "model": "Iris",
    "channel": "gram"
  }
];

// Formatear múltiples cuentas
const formattedAccounts = formatMultipleAccounts(accounts);

// Mostrar en formato JSON como en el ejemplo
const output = {
  accounts: formattedAccounts.map(account => ({
    account: account.account,
    class_info: account.class_info,
    account_origin: account.account_origin
  }))
};

console.log(JSON.stringify(output, null, 2));

console.log(`\n✅ Total de cuentas procesadas: ${formattedAccounts.length}`);


function formatDeviceData(input) {
  const proxyParts = input.proxy.split(':');
  if (proxyParts.length !== 4) {
    throw new Error('El proxy debe tener exactamente cuatro partes: host:port:username:password');
  }
  const socks5Url = `socks5://${proxyParts[2]}:${proxyParts[3]}@${proxyParts[0]}:${proxyParts[1]}`;
  return {
    account: `${input.authToken}:${input.devicePersistentId}:${input.refreshToken}:${input.latitude}:${input.longitude}:${socks5Url}`,
    class_info: {
      class_type: input.model,
      class_color: "#ffb3f5" // Color estático según tu ejemplo
    },
    account_origin: "ios" // Valor estático según tu ejemplo
  };
}

function formatMultipleAccounts(accounts) {
  return accounts.map((account, index) => ({
    id: index + 1, // ID incremental
    ...formatDeviceData(account),
    metadata: {
      udid: account.udid,
      deviceName: account.deviceName,
      deviceId: account.deviceId,
      timestamp: account.timestamp,
      channel: account.channel
    }
  }));
}

