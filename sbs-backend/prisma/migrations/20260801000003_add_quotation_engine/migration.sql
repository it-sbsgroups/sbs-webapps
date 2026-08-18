-- AlterTable: structured quotation fields on rfq_replies
ALTER TABLE `rfq_replies`
  ADD COLUMN `items` JSON NULL,
  ADD COLUMN `subtotal` DOUBLE NULL,
  ADD COLUMN `overallDiscountPercent` DOUBLE NULL DEFAULT 0,
  ADD COLUMN `discountTotal` DOUBLE NULL,
  ADD COLUMN `grandTotal` DOUBLE NULL,
  ADD COLUMN `termsAndConditions` TEXT NULL,
  ADD COLUMN `includePrivacyPolicy` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: default T&C / privacy policy text on rfq_settings
ALTER TABLE `rfq_settings`
  ADD COLUMN `defaultTermsAndConditions` TEXT NULL,
  ADD COLUMN `privacyPolicyText` TEXT NULL;
