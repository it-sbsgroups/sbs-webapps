-- AlterTable
ALTER TABLE `news_posts` ADD COLUMN `metaDescription` TEXT NULL,
    ADD COLUMN `metaTitle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `designFileFormat` VARCHAR(191) NULL,
    ADD COLUMN `designFileName` VARCHAR(191) NULL,
    ADD COLUMN `designFilePublicId` VARCHAR(191) NULL,
    ADD COLUMN `designFileResourceType` VARCHAR(191) NULL,
    ADD COLUMN `designFileSize` INTEGER NULL,
    ADD COLUMN `designFileUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `rfq_settings` MODIFY `submitText` VARCHAR(191) NOT NULL DEFAULT '🚀 Dispatch Quotation Slip';
