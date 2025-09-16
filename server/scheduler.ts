import { storage } from './storage';

class GroupMessageScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Group message scheduler started');
    // Run an immediate pass so any already-due messages are processed without waiting for the first interval
    this.processDueMessages().catch(err => console.error('Scheduler immediate pass error:', err));
    
    // Check every 30 seconds for due messages
    this.intervalId = setInterval(async () => {
      try {
        await this.processDueMessages();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Group message scheduler stopped');
  }

  private async processDueMessages() {
    const dueMessages = await storage.getDueGroupMessages();
    
    for (const message of dueMessages) {
      try {
        console.log(`Processing group message: ${message.id}`);
        await storage.processGroupMessage(message.id);
      } catch (error) {
        console.error(`Failed to process group message ${message.id}:`, error);
        // Mark as failed
        // await storage.markGroupMessageFailed(message.id, error.message);
      }
    }
  }
}

export const scheduler = new GroupMessageScheduler();
