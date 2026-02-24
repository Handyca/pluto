#!/usr/bin/env bun

// Development script to run Next.js and WebSocket server concurrently

import { spawn } from 'child_process';

console.log('🚀 Starting Pluto development servers...\n');

// Start WebSocket server
const wsServer = spawn('bun', ['run', 'server/websocket.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
});

// Start Next.js dev server
const nextServer = spawn('bun', ['run', 'dev:next'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
});

// Handle termination
const cleanup = () => {
  console.log('\n🛑 Shutting down servers...');
  wsServer.kill();
  nextServer.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

wsServer.on('error', (error) => {
  console.error('❌ WebSocket server error:', error);
});

nextServer.on('error', (error) => {
  console.error('❌ Next.js server error:', error);
});

wsServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ WebSocket server exited with code ${code}`);
  }
});

nextServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Next.js server exited with code ${code}`);
  }
});
