import { sendOpenClawMessage } from './lib/workflows/engine/executors/openclawClient';

async function main() {
  console.log('Sending message to Ivy...');
  try {
    const response = await sendOpenClawMessage('ivy', 'What is the weather today?');
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
