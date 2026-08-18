-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `brandId` VARCHAR(191) NULL,
    ADD COLUMN `brochureFormat` VARCHAR(191) NULL,
    ADD COLUMN `brochureName` VARCHAR(191) NULL,
    ADD COLUMN `brochurePublicId` VARCHAR(191) NULL,
    ADD COLUMN `brochureResourceType` VARCHAR(191) NULL,
    ADD COLUMN `brochureSize` INTEGER NULL,
    ADD COLUMN `brochureUrl` TEXT NULL,
    ADD COLUMN `designFileFormat` VARCHAR(191) NULL,
    ADD COLUMN `designFileName` VARCHAR(191) NULL,
    ADD COLUMN `designFilePublicId` VARCHAR(191) NULL,
    ADD COLUMN `designFileResourceType` VARCHAR(191) NULL,
    ADD COLUMN `designFileSize` INTEGER NULL,
    ADD COLUMN `designFileUrl` TEXT NULL,
    ADD COLUMN `keyFeatures` TEXT NULL,
    ADD COLUMN `specifications` JSON NULL;

-- AlterTable
ALTER TABLE `rfq_settings` MODIFY `submitText` VARCHAR(191) NOT NULL DEFAULT '🚀 Dispatch Quotation Slip';

-- CreateTable
CREATE TABLE `_VariantApplications` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_VariantApplications_AB_unique`(`A`, `B`),
    INDEX `_VariantApplications_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_VariantApplications` ADD CONSTRAINT `_VariantApplications_A_fkey` FOREIGN KEY (`A`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_VariantApplications` ADD CONSTRAINT `_VariantApplications_B_fkey` FOREIGN KEY (`B`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
