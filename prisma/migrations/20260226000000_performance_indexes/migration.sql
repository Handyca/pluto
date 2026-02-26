-- Add composite index on messages table for efficient participant queries.
-- This covers the common pattern: fetch visible messages for a session ordered by time.
CREATE INDEX "messages_sessionId_isVisible_createdAt_idx" ON "messages"("sessionId", "isVisible", "createdAt");
