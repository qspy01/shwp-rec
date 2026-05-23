-- CreateIndex: speed up stale-stream sweeper queries (filter by startTime, updatedAt)
CREATE INDEX "Stream_startTime_idx" ON "Stream"("startTime");
CREATE INDEX "Stream_updatedAt_idx" ON "Stream"("updatedAt");
