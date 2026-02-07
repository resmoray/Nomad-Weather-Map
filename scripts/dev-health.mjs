import net from "node:net";

const PORTS = [
  { port: 5173, name: "Frontend (Vite)" },
  { port: 8787, name: "Backend (Season API)" },
];

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

const results = await Promise.all(PORTS.map(async ({ port, name }) => ({
  port,
  name,
  inUse: await checkPort(port),
})));

let hasConflict = false;

for (const result of results) {
  if (result.inUse) {
    hasConflict = true;
    console.log(`Port ${result.port} (${result.name}) is already in use.`);
  } else {
    console.log(`Port ${result.port} (${result.name}) is available.`);
  }
}

if (hasConflict) {
  console.log("Stop existing processes first (or run scripts/stop-dev.sh).");
  process.exit(1);
}

console.log("Health check OK.");
