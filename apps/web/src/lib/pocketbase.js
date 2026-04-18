
import pb from '@/lib/pocketbaseClient.js';

// Re-export the PocketBase client for convenience
export default pb;

// Helper to get current user ID
export const getCurrentUserId = () => {
  if (!pb.authStore.isValid || !pb.authStore.model) {
    throw new Error('User not authenticated');
  }
  return pb.authStore.model.id;
};
