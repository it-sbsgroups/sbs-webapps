-- AlterTable
ALTER TABLE `products`
  ADD COLUMN `isPrelaunch` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `launchDate` DATETIME(3) NULL,
  ADD COLUMN `prelaunchTeaser` TEXT NULL;

-- CreateTable
CREATE TABLE `product_launch_notifies` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `product_launch_notifies_productId_email_key`(`productId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_launch_notifies` ADD CONSTRAINT `product_launch_notifies_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
