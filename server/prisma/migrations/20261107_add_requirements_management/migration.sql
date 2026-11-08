-- ============================================================
-- DevFlow: Requirements Management — Phase 1 Migration
-- Additive only — no existing tables modified or dropped.
-- ============================================================

-- 1. requirements
CREATE TABLE IF NOT EXISTS `requirements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `type` ENUM('FUNCTIONAL','NON_FUNCTIONAL','BUSINESS','TECHNICAL','SECURITY','PERFORMANCE','USABILITY','COMPLIANCE','INTERFACE') NOT NULL DEFAULT 'FUNCTIONAL',
    `categoryId` INTEGER NULL,
    `description` LONGTEXT NULL,
    `businessJustification` TEXT NULL,
    `expectedBehavior` TEXT NULL,
    `preconditions` TEXT NULL,
    `constraints` TEXT NULL,
    `dependencies` TEXT NULL,
    `referenceLinks` TEXT NULL,
    `attachments` TEXT NULL,
    `priority` ENUM('CRITICAL','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    `workflowStatus` ENUM('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED','DEPRECATED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `implementationStatus` ENUM('NOT_STARTED','IN_PROGRESS','BLOCKED','IMPLEMENTED','VERIFIED') NOT NULL DEFAULT 'NOT_STARTED',
    `authorId` INTEGER NOT NULL,
    `responsibleTeamId` INTEGER NULL,
    `responsibleMemberId` INTEGER NULL,
    `reviewerId` INTEGER NULL,
    `assigneeId` INTEGER NULL,
    `collaborators` TEXT NULL,
    `targetDate` DATETIME(3) NULL,
    `businessImpact` TEXT NULL,
    `riskLevel` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NULL,
    `complexity` ENUM('LOW','MEDIUM','HIGH','VERY_HIGH') NULL,
    `currentVersion` INTEGER NOT NULL DEFAULT 1,
    `submittedAt` DATETIME(3) NULL,
    `submittedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` INTEGER NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `requirements_projectId_idx`(`projectId`),
    INDEX `requirements_workflowStatus_idx`(`workflowStatus`),
    INDEX `requirements_implementationStatus_idx`(`implementationStatus`),
    INDEX `requirements_authorId_idx`(`authorId`),
    INDEX `requirements_reviewerId_idx`(`reviewerId`),
    INDEX `requirements_assigneeId_idx`(`assigneeId`),
    INDEX `requirements_responsibleTeamId_idx`(`responsibleTeamId`),
    INDEX `requirements_categoryId_idx`(`categoryId`),
    INDEX `requirements_priority_idx`(`priority`),
    UNIQUE INDEX `requirements_projectId_code_key`(`projectId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. acceptance_criteria
CREATE TABLE IF NOT EXISTS `acceptance_criteria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requirementId` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `verificationMethod` TEXT NULL,
    `relatedTestId` INTEGER NULL,
    `isComplete` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `acceptance_criteria_requirementId_idx`(`requirementId`),
    UNIQUE INDEX `acceptance_criteria_requirementId_code_key`(`requirementId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. requirement_categories
CREATE TABLE IF NOT EXISTS `requirement_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `defaultType` ENUM('FUNCTIONAL','NON_FUNCTIONAL','BUSINESS','TECHNICAL','SECURITY','PERFORMANCE','USABILITY','COMPLIANCE','INTERFACE') NOT NULL DEFAULT 'FUNCTIONAL',
    `scope` ENUM('ORG','PROJECT') NOT NULL DEFAULT 'PROJECT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `organizationId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `requirement_categories_organizationId_idx`(`organizationId`),
    INDEX `requirement_categories_projectId_idx`(`projectId`),
    INDEX `requirement_categories_scope_idx`(`scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. requirement_templates
CREATE TABLE IF NOT EXISTS `requirement_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `structure` LONGTEXT NOT NULL,
    `scope` ENUM('ORG','PROJECT') NOT NULL DEFAULT 'ORG',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `organizationId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `requirement_templates_organizationId_idx`(`organizationId`),
    INDEX `requirement_templates_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. requirement_versions
CREATE TABLE IF NOT EXISTS `requirement_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requirementId` INTEGER NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `changedById` INTEGER NOT NULL,
    `changeReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `requirement_versions_requirementId_idx`(`requirementId`),
    INDEX `requirement_versions_changedById_idx`(`changedById`),
    UNIQUE INDEX `requirement_versions_requirementId_versionNumber_key`(`requirementId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. requirement_reviews
CREATE TABLE IF NOT EXISTS `requirement_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requirementId` INTEGER NOT NULL,
    `reviewerId` INTEGER NOT NULL,
    `versionNumber` INTEGER NOT NULL DEFAULT 1,
    `decision` ENUM('APPROVED','CHANGES_REQUESTED','REJECTED') NOT NULL,
    `checklist` TEXT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `requirement_reviews_requirementId_idx`(`requirementId`),
    INDEX `requirement_reviews_reviewerId_idx`(`reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. requirement_dependencies
CREATE TABLE IF NOT EXISTS `requirement_dependencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromRequirementId` INTEGER NOT NULL,
    `toRequirementId` INTEGER NOT NULL,
    `type` ENUM('DEPENDS_ON','BLOCKS','RELATED_TO','ENHANCES','CONFLICTS_WITH') NOT NULL DEFAULT 'RELATED_TO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `requirement_dependencies_fromRequirementId_idx`(`fromRequirementId`),
    INDEX `requirement_dependencies_toRequirementId_idx`(`toRequirementId`),
    UNIQUE INDEX `requirement_dependencies_fromRequirementId_toRequirementId_key`(`fromRequirementId`, `toRequirementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. requirement_comments
CREATE TABLE IF NOT EXISTS `requirement_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requirementId` INTEGER NOT NULL,
    `versionId` INTEGER NULL,
    `authorId` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `mentions` TEXT NULL,
    `attachments` TEXT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `parentId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `requirement_comments_requirementId_idx`(`requirementId`),
    INDEX `requirement_comments_authorId_idx`(`authorId`),
    INDEX `requirement_comments_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 9. requirement_links
CREATE TABLE IF NOT EXISTS `requirement_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requirementId` INTEGER NOT NULL,
    `targetType` ENUM('TASK','COMMIT','PULL_REQUEST','TEST','DEFECT','RELEASE','OBJECTIVE') NOT NULL,
    `targetId` INTEGER NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `taskId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `requirement_links_requirementId_idx`(`requirementId`),
    INDEX `requirement_links_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `requirement_links_taskId_idx`(`taskId`),
    UNIQUE INDEX `requirement_links_requirementId_targetType_targetId_key`(`requirementId`, `targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Foreign Keys
-- ============================================================

-- requirements
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `requirement_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_responsibleTeamId_fkey`
  FOREIGN KEY (`responsibleTeamId`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_responsibleMemberId_fkey`
  FOREIGN KEY (`responsibleMemberId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_assigneeId_fkey`
  FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_submittedById_fkey`
  FOREIGN KEY (`submittedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- acceptance_criteria
ALTER TABLE `acceptance_criteria` ADD CONSTRAINT `acceptance_criteria_requirementId_fkey`
  FOREIGN KEY (`requirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- requirement_categories
ALTER TABLE `requirement_categories` ADD CONSTRAINT `requirement_categories_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_categories` ADD CONSTRAINT `requirement_categories_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- requirement_templates
ALTER TABLE `requirement_templates` ADD CONSTRAINT `requirement_templates_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_templates` ADD CONSTRAINT `requirement_templates_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- requirement_versions
ALTER TABLE `requirement_versions` ADD CONSTRAINT `requirement_versions_requirementId_fkey`
  FOREIGN KEY (`requirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_versions` ADD CONSTRAINT `requirement_versions_changedById_fkey`
  FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- requirement_reviews
ALTER TABLE `requirement_reviews` ADD CONSTRAINT `requirement_reviews_requirementId_fkey`
  FOREIGN KEY (`requirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_reviews` ADD CONSTRAINT `requirement_reviews_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- requirement_dependencies
ALTER TABLE `requirement_dependencies` ADD CONSTRAINT `requirement_dependencies_fromRequirementId_fkey`
  FOREIGN KEY (`fromRequirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_dependencies` ADD CONSTRAINT `requirement_dependencies_toRequirementId_fkey`
  FOREIGN KEY (`toRequirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- requirement_comments
ALTER TABLE `requirement_comments` ADD CONSTRAINT `requirement_comments_requirementId_fkey`
  FOREIGN KEY (`requirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_comments` ADD CONSTRAINT `requirement_comments_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_comments` ADD CONSTRAINT `requirement_comments_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `requirement_comments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- requirement_links
ALTER TABLE `requirement_links` ADD CONSTRAINT `requirement_links_requirementId_fkey`
  FOREIGN KEY (`requirementId`) REFERENCES `requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requirement_links` ADD CONSTRAINT `requirement_links_taskId_fkey`
  FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
