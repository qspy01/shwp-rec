-- AlterTable: add HLS manifest path for VOD streaming
ALTER TABLE "Stream" ADD COLUMN "hlsKey" TEXT;
