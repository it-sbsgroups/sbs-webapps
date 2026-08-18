-- CreateTable
CREATE TABLE `product_variants` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `attributes` JSON NOT NULL,
    `model` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `images` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add variantId to rfq_items
ALTER TABLE `rfq_items` ADD COLUMN `variantId` VARCHAR(191) NULL;

-- Add the new composite unique index FIRST (it also starts with `rfqId`,
-- so it can immediately back the rfqId foreign key once the old index is
-- dropped — dropping first caused MySQL error 1553: "needed in a foreign
-- key constraint").
ALTER TABLE `rfq_items` ADD UNIQUE INDEX `rfq_items_rfqId_productId_variantId_key`(`rfqId`, `productId`, `variantId`);
ALTER TABLE `rfq_items` DROP INDEX `rfq_items_rfqId_productId_key`;

-- AddForeignKey
ALTER TABLE `rfq_items` ADD CONSTRAINT `rfq_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
