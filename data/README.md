# Sample Data & Dataset Instructions

When the backend starts, `backend/services/sample_data_service.py` automatically generates two non-sensitive, multi-package Java project archives in this `data/` directory:

1. `ecommerce-order-engine-v1.zip` (**Baseline Pre-Refactoring**):
   - Contains 7 Java classes across `com.platform.ecommerce.*` packages, including a complex `OrderProcessor.java` God Class with deep control-flow nesting, high cyclomatic complexity, long methods, and high coupling fan-out.
2. `ecommerce-order-engine-v2-refactored.zip` (**Post-Refactoring Revision**):
   - Contains the refactored revision of `OrderProcessor.java` and `PaymentGatewayService.java` with decomposed helper methods, guard clauses, reduced complexity, and improved Javadoc comments.

You can upload these `.zip` files manually on the **Upload Project** page, or trigger their analysis directly from the UI to demonstrate single-run analytics and **Before-and-After Comparison**.
