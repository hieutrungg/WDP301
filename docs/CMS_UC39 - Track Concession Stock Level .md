# Use Case Specification: CMS_UC39 - Track Concession Stock Level

## 1. General Information
- **Use Case ID & Name:** CMS_UC39 - Track Concession Stock Level
- **Created by:** VuLA
- **Primary Actor:** Staff
- **Secondary Actor:** None

## 2. Description
Allows the Staff to view and monitor current stock levels of concession items such as food, beverages, and combos. Staff can check available quantities, identify low-stock or out-of-stock items, and use the information to support daily concession operations.

## 3. Preconditions
- Staff is logged into the system.
- Concession items have been created in the system.

## 4. Main Sequence
1. Staff navigates to the concession stock management screen.
2. System displays the list of concession items, including item name, category, current quantity, unit, and minimum stock threshold.
3. Staff searches or filters items by name, category, or stock status if needed.
4. Staff reviews the current stock level of each concession item.
5. System highlights items that are at or below the minimum stock threshold.
6. System marks items with zero quantity as out of stock.
7. Staff views low-stock or out-of-stock items to identify which items need restocking.

## 5. Alternative Sequences
- **Step 3:** If no item matches the search or filter criteria, the system displays an empty result message.
- **Step 5:** If there are no low-stock items, the system displays all items with normal stock status.
- **Step 6:** If there are no out-of-stock items, the system does not show any out-of-stock alert.

## 6. Postconditions
- Concession stock levels are up to date in the system.

## 7. Business Rules
- **BR-48**