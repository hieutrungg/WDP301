# Use Case Specification: CMS_UC40 - Stock Goods

## 1. General Information

* **ID and Name:** `CMS_UC40` - Stock Goods
* **Primary Actor:** Staff
* **Secondary Actor:** None

## 2. Description

Allows the Staff to receive and record new goods or inventory items into the branch stock. Staff can select the goods, enter received quantities, update stock levels, and record stock-in information to keep concession inventory accurate.

## 3. Preconditions

1. Staff is logged into the system and has permission to access the inventory management module.
2. Goods or concession items already exist in the system.

## 4. Main Sequence

| Step | Actor Action | System Action |
| :--- | :--- | :--- |
| **1** | Staff navigates to the concession stock management screen. | |
| **2** | Staff selects the **Stock Goods** function. | |
| **3** | | System displays the stock goods form. |
| **4** | Staff selects the goods or concession items to be stocked. | |
| **5** | Staff enters the received quantity for each selected item. | |
| **6** | Staff enters stock-in information such as supplier, received date, and note if needed. | |
| **7** | | System validates the entered stock-in information. |
| **8** | Staff confirms the stock goods request. | |
| **9** | | System adds the received quantities to the current stock levels. |
| **10** | | System records the stock-in transaction in the inventory history. |
| **11** | | System displays a successful stock update confirmation message. |

## 5. Alternative Sequences

* **At Step 4 (Goods not found):**
  * If the required goods cannot be found, Staff can cancel the action or contact the branch manager/admin to create the item first.

* **At Step 7 (Invalid or missing input):**
  * If the entered quantity is invalid or missing, the system displays a validation error and asks Staff to correct the information.

* **At Step 9 (Stock update fails):**
  * If the stock update fails, the system displays an error message and keeps the previous stock quantity unchanged.

## 6. Post-conditions

* Received goods are recorded successfully.
* Branch stock levels are updated.

## 7. Business Rules

* **BR-49**
* **BR-50**