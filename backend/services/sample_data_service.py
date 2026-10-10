import os
import zipfile


V1_JAVA_FILES = {
    "src/com/platform/ecommerce/OrderProcessor.java": """package com.platform.ecommerce;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;
import com.platform.ecommerce.payment.PaymentGatewayService;
import com.platform.ecommerce.inventory.InventoryManager;
import com.platform.ecommerce.pricing.DiscountCalculator;
import com.platform.ecommerce.shipping.ShippingRateEstimator;
import com.platform.ecommerce.tax.TaxComplianceEngine;
import com.platform.ecommerce.validation.CustomerValidator;
import com.platform.ecommerce.audit.OrderAuditLogger;
import com.platform.ecommerce.notification.EmailDispatcher;
import com.platform.ecommerce.fraud.FraudRuleEngine;
import com.platform.ecommerce.loyalty.LoyaltyPointLedger;
import com.platform.ecommerce.warehouse.WarehouseRouter;
import com.platform.ecommerce.reporting.MetricsCollector;

public class OrderProcessor {
    private PaymentGatewayService paymentService;
    private InventoryManager inventoryManager;
    private DiscountCalculator discountCalculator;
    private ShippingRateEstimator shippingEstimator;
    private TaxComplianceEngine taxEngine;
    private CustomerValidator customerValidator;
    private OrderAuditLogger auditLogger;
    private EmailDispatcher emailDispatcher;
    private FraudRuleEngine fraudEngine;
    private LoyaltyPointLedger loyaltyLedger;
    private WarehouseRouter warehouseRouter;
    private MetricsCollector metricsCollector;
    private int maxRetryAttempts = 3;
    private double highValueThreshold = 5000.0;

    public String processCheckoutWorkflow(
        String orderId,
        String customerId,
        List<String> skuList,
        Map<String, Integer> quantities,
        Map<String, Double> unitPrices,
        String couponCode,
        String shippingRegion,
        String paymentMethod,
        boolean isExpressDelivery
    ) {
        if (orderId == null || orderId.isEmpty() || customerId == null || customerId.isEmpty()) {
            return "INVALID_ORDER_PARAMETERS";
        }
        if (skuList == null || skuList.isEmpty() || quantities == null || unitPrices == null) {
            return "EMPTY_CART_ITEMS";
        }

        double grossTotal = 0.0;
        int totalUnits = 0;

        for (int i = 0; i < skuList.size(); i++) {
            String sku = skuList.get(i);
            Integer qty = quantities.get(sku);
            Double price = unitPrices.get(sku);
            if (qty != null && qty > 0 && price != null && price >= 0.0) {
                if (qty > 100) {
                    if (shippingRegion.equals("INTL_RESTRICTED") || shippingRegion.equals("EMBARGO")) {
                        return "BULK_EXPORT_RESTRICTED";
                    } else {
                        if (price > 250.0 && !paymentMethod.equals("WIRE_TRANSFER")) {
                            return "HIGH_VOLUME_REQUIRES_WIRE";
                        } else {
                            grossTotal += (qty * price * 0.95);
                        }
                    }
                } else {
                    grossTotal += (qty * price);
                }
                totalUnits += qty;
            } else {
                return "INVALID_LINE_ITEM_" + sku;
            }
        }

        double discountAmount = 0.0;
        if (couponCode != null && !couponCode.isEmpty()) {
            if (couponCode.startsWith("VIP") && grossTotal >= 500.0) {
                discountAmount = grossTotal * 0.20;
            } else if (couponCode.startsWith("SEASONAL") && grossTotal >= 100.0) {
                discountAmount = grossTotal * 0.10;
            } else if (couponCode.equals("FLAT50") && grossTotal >= 200.0) {
                discountAmount = 50.0;
            } else if (couponCode.equals("STAFF_DISC")) {
                discountAmount = grossTotal * 0.25;
            }
        }

        double netTotal = grossTotal - discountAmount;
        if (netTotal < 0.0) {
            netTotal = 0.0;
        }

        double shippingFee = 15.0;
        if (isExpressDelivery) {
            if (shippingRegion.startsWith("INTL")) {
                shippingFee = 75.0 + (totalUnits * 3.5);
            } else {
                shippingFee = 30.0 + (totalUnits * 1.5);
            }
        } else {
            if (netTotal > 250.0 && !shippingRegion.startsWith("INTL")) {
                shippingFee = 0.0;
            } else {
                shippingFee = 12.0 + (totalUnits * 0.75);
            }
        }

        double finalPayable = netTotal + shippingFee;
        if (finalPayable >= highValueThreshold) {
            int attempt = 0;
            boolean verified = false;
            while (attempt < maxRetryAttempts && !verified) {
                attempt++;
                if (paymentMethod.equals("CREDIT_CARD") || paymentMethod.equals("WIRE_TRANSFER")) {
                    verified = true;
                }
            }
            if (!verified) {
                return "HIGH_VALUE_VERIFICATION_FAILED";
            }
        }

        return "ORDER_CONFIRMED:" + orderId + ":" + finalPayable;
    }

    public int evaluateOrderRiskScore(
        String customerTier,
        double orderAmount,
        int priorChargebacks,
        boolean billingMatchesShipping,
        String deviceFingerprint,
        int accountAgeDays
    ) {
        int score = 0;
        if (priorChargebacks > 0) {
            score += priorChargebacks * 35;
        }
        if (!billingMatchesShipping) {
            if (orderAmount > 1000.0) {
                score += 40;
            } else {
                score += 15;
            }
        }
        if (accountAgeDays < 7) {
            if (orderAmount > 500.0) {
                score += 30;
            } else {
                score += 10;
            }
        }
        if (deviceFingerprint == null || deviceFingerprint.length() < 8) {
            score += 25;
        }
        if ("PLATINUM".equals(customerTier) && priorChargebacks == 0) {
            score -= 20;
        }
        return score < 0 ? 0 : (score > 100 ? 100 : score);
    }

    public String reconcileStaleOrders(List<String> pendingIds, int timeoutMinutes, boolean forceCancel) {
        int cancelled = 0;
        int retained = 0;
        if (pendingIds != null) {
            for (String id : pendingIds) {
                if (id != null && !id.isEmpty()) {
                    if (timeoutMinutes > 120 || forceCancel) {
                        cancelled++;
                    } else {
                        retained++;
                    }
                }
            }
        }
        return "CANCELLED=" + cancelled + ",RETAINED=" + retained;
    }
}
""",
    "src/com/platform/ecommerce/payment/PaymentGatewayService.java": """package com.platform.ecommerce.payment;

import java.util.Map;
import java.util.HashMap;

public class PaymentGatewayService {
    private String primaryProvider = "STRIPE_GLOBAL";
    private String backupProvider = "ADYEN_ENTERPRISE";
    private int timeoutMillis = 4500;

    public String authorizeTransaction(
        String transactionId,
        double amount,
        String currency,
        String cardNetwork,
        int retryLimit,
        boolean allowFallback
    ) {
        if (transactionId == null || amount <= 0.0 || currency == null) {
            return "REJECTED_INVALID_INPUT";
        }

        int tries = 0;
        while (tries <= retryLimit) {
            tries++;
            switch (currency) {
                case "USD":
                case "EUR":
                case "GBP":
                    if (amount > 25000.0 && "AMEX".equals(cardNetwork)) {
                        if (!allowFallback) {
                            return "DECLINED_LIMIT_EXCEEDED";
                        }
                    } else {
                        return "AUTHORIZED_" + primaryProvider + "_" + transactionId;
                    }
                    break;
                case "JPY":
                case "INR":
                case "AUD":
                    if (amount > 1000000.0 && tries == 1) {
                        continue;
                    }
                    return "AUTHORIZED_REGIONAL_" + transactionId;
                default:
                    if (allowFallback) {
                        return "AUTHORIZED_" + backupProvider + "_" + transactionId;
                    }
                    return "UNSUPPORTED_CURRENCY";
            }
        }
        return "GATEWAY_TIMEOUT";
    }

    public double calculateGatewayFee(double amount, String cardNetwork, boolean international) {
        double rate = 0.029;
        if ("AMEX".equals(cardNetwork)) {
            rate = 0.035;
        } else if ("DEBIT".equals(cardNetwork)) {
            rate = 0.015;
        }
        if (international) {
            rate += 0.012;
        }
        return (amount * rate) + 0.30;
    }
}
""",
    "src/com/platform/ecommerce/inventory/InventoryManager.java": """package com.platform.ecommerce.inventory;

import java.util.Map;
import java.util.HashMap;

/**
 * Manages warehouse stock levels, reservations, and reorder alerts.
 */
public class InventoryManager {
    private Map<String, Integer> stockBySku = new HashMap<>();
    private int safetyStockThreshold = 10;

    public InventoryManager() {
        stockBySku.put("SKU-1001", 120);
        stockBySku.put("SKU-1002", 45);
        stockBySku.put("SKU-1003", 8);
    }

    /**
     * Checks whether sufficient units are available for a requested SKU.
     */
    public boolean hasAvailableStock(String sku, int requestedUnits) {
        if (sku == null || requestedUnits <= 0) {
            return false;
        }
        Integer current = stockBySku.get(sku);
        return current != null && current >= requestedUnits;
    }

    /**
     * Reserves inventory units and returns reservation status code.
     */
    public String reserveStock(String sku, int requestedUnits, boolean allowBackorder) {
        if (sku == null || requestedUnits <= 0) {
            return "INVALID_REQUEST";
        }
        int available = stockBySku.getOrDefault(sku, 0);
        if (available >= requestedUnits) {
            stockBySku.put(sku, available - requestedUnits);
            return "RESERVED";
        } else if (allowBackorder && requestedUnits <= 25) {
            stockBySku.put(sku, available - requestedUnits);
            return "BACKORDERED";
        }
        return "INSUFFICIENT_STOCK";
    }

    public boolean needsReplenishment(String sku) {
        int available = stockBySku.getOrDefault(sku, 0);
        return available <= safetyStockThreshold;
    }
}
""",
    "src/com/platform/ecommerce/pricing/DiscountCalculator.java": """package com.platform.ecommerce.pricing;

/**
 * Calculates promotional and tier-based discounts for customer orders.
 */
public class DiscountCalculator {

    /**
     * Computes total discount amount bounded between 0 and 40% of subtotal.
     */
    public double calculateDiscount(double subtotal, String loyaltyTier, String promoCode, int itemCount) {
        if (subtotal <= 0.0) {
            return 0.0;
        }

        double tierRate = 0.0;
        if ("GOLD".equals(loyaltyTier)) {
            tierRate = 0.08;
        } else if ("PLATINUM".equals(loyaltyTier)) {
            tierRate = 0.12;
        } else if ("SILVER".equals(loyaltyTier)) {
            tierRate = 0.04;
        }

        double promoRate = 0.0;
        if (promoCode != null && !promoCode.isEmpty()) {
            if ("WELCOME10".equals(promoCode)) {
                promoRate = 0.10;
            } else if ("BUNDLE15".equals(promoCode) && itemCount >= 3) {
                promoRate = 0.15;
            }
        }

        double combinedRate = tierRate + promoRate;
        if (combinedRate > 0.40) {
            combinedRate = 0.40;
        }
        return subtotal * combinedRate;
    }
}
""",
    "src/com/platform/ecommerce/shipping/ShippingRateEstimator.java": """package com.platform.ecommerce.shipping;

public class ShippingRateEstimator {

    public double estimateShippingCost(
        double totalWeightKg,
        String destinationZone,
        boolean isExpress,
        boolean isFragile,
        boolean hasInsurance,
        double declaredValue
    ) {
        if (totalWeightKg <= 0.0 || destinationZone == null) {
            return 0.0;
        }

        double baseCost = 8.50;
        if ("DOMESTIC_LOCAL".equals(destinationZone)) {
            baseCost = 6.00 + (totalWeightKg * 1.10);
        } else if ("DOMESTIC_REMOTE".equals(destinationZone)) {
            baseCost = 14.00 + (totalWeightKg * 2.25);
        } else if ("INTERNATIONAL_EU".equals(destinationZone)) {
            baseCost = 28.00 + (totalWeightKg * 4.50);
        } else if ("INTERNATIONAL_APAC".equals(destinationZone)) {
            baseCost = 34.00 + (totalWeightKg * 5.20);
        } else {
            baseCost = 42.00 + (totalWeightKg * 6.00);
        }

        if (isExpress) {
            baseCost *= 1.65;
        }
        if (isFragile) {
            baseCost += 12.50;
        }
        if (hasInsurance && declaredValue > 100.0) {
            baseCost += declaredValue * 0.015;
        }
        return baseCost;
    }
}
""",
    "src/com/platform/ecommerce/validation/CustomerValidator.java": """package com.platform.ecommerce.validation;

/**
 * Provides clean validation methods for customer profile and address records.
 */
public class CustomerValidator {

    /**
     * Validates that a customer email and postal code satisfy basic structural rules.
     */
    public boolean isValidCustomerContact(String email, String postalCode) {
        if (email == null || postalCode == null) {
            return false;
        }
        boolean validEmail = email.contains("@") && email.contains(".");
        boolean validPostal = postalCode.trim().length() >= 4;
        return validEmail && validPostal;
    }

    /**
     * Checks whether the customer account status permits checkout.
     */
    public boolean isAccountActive(String status) {
        return "ACTIVE".equals(status) || "VERIFIED".equals(status);
    }
}
""",
    "src/com/platform/ecommerce/audit/OrderAuditLogger.java": """package com.platform.ecommerce.audit;

import java.util.ArrayList;
import java.util.List;

/**
 * Records structured audit trail entries for order lifecycle transitions.
 */
public class OrderAuditLogger {
    private final List<String> entries = new ArrayList<>();

    /**
     * Appends a formatted event entry to the in-memory audit log.
     */
    public void recordEvent(String orderId, String eventType, String actor) {
        if (orderId == null || eventType == null) {
            return;
        }
        String safeActor = (actor != null && !actor.isEmpty()) ? actor : "SYSTEM";
        entries.add(orderId + "|" + eventType + "|" + safeActor);
    }

    /**
     * Returns the number of recorded audit events.
     */
    public int getEntryCount() {
        return entries.size();
    }
}
""",
}


V2_JAVA_FILES = {
    **V1_JAVA_FILES,
    "src/com/platform/ecommerce/OrderProcessor.java": """package com.platform.ecommerce;

import java.util.List;
import java.util.Map;
import com.platform.ecommerce.pricing.DiscountCalculator;
import com.platform.ecommerce.shipping.ShippingRateEstimator;
import com.platform.ecommerce.validation.CustomerValidator;

/**
 * Refactored OrderProcessor that delegates pricing, shipping, and validation
 * to cohesive domain collaborators with reduced cyclomatic complexity.
 */
public class OrderProcessor {
    private final DiscountCalculator discountCalculator = new DiscountCalculator();
    private final ShippingRateEstimator shippingEstimator = new ShippingRateEstimator();
    private final CustomerValidator customerValidator = new CustomerValidator();
    private final double highValueThreshold = 5000.0;

    /**
     * Coordinates order validation, subtotal calculation, and final total determination.
     */
    public String processCheckoutWorkflow(
        String orderId,
        String customerId,
        List<String> skuList,
        Map<String, Integer> quantities,
        Map<String, Double> unitPrices,
        String couponCode,
        String shippingRegion
    ) {
        if (!isValidOrderHeader(orderId, customerId, skuList)) {
            return "INVALID_ORDER_PARAMETERS";
        }

        double grossTotal = calculateCartGrossTotal(skuList, quantities, unitPrices);
        if (grossTotal < 0.0) {
            return "INVALID_LINE_ITEMS";
        }

        double discount = discountCalculator.calculateDiscount(grossTotal, "GOLD", couponCode, skuList.size());
        double netTotal = Math.max(0.0, grossTotal - discount);
        double shippingFee = shippingEstimator.estimateShippingCost(2.5, shippingRegion, false, false, false, netTotal);
        double finalPayable = netTotal + shippingFee;

        if (finalPayable >= highValueThreshold) {
            return "REQUIRES_MANUAL_TREASURY_APPROVAL:" + orderId;
        }
        return "ORDER_CONFIRMED:" + orderId + ":" + finalPayable;
    }

    /**
     * Validates non-empty order identifier, customer identifier, and item list.
     */
    private boolean isValidOrderHeader(String orderId, String customerId, List<String> skuList) {
        if (orderId == null || orderId.isEmpty() || customerId == null || customerId.isEmpty()) {
            return false;
        }
        return skuList != null && !skuList.isEmpty();
    }

    /**
     * Sums line-item prices across valid SKUs or returns -1.0 when invalid quantities appear.
     */
    private double calculateCartGrossTotal(
        List<String> skuList,
        Map<String, Integer> quantities,
        Map<String, Double> unitPrices
    ) {
        if (quantities == null || unitPrices == null) {
            return -1.0;
        }
        double total = 0.0;
        for (String sku : skuList) {
            Integer qty = quantities.get(sku);
            Double price = unitPrices.get(sku);
            if (qty == null || qty <= 0 || price == null || price < 0.0) {
                return -1.0;
            }
            total += qty * price;
        }
        return total;
    }

    /**
     * Computes a bounded fraud risk indicator from chargeback history and account age.
     */
    public int evaluateOrderRiskScore(int priorChargebacks, boolean billingMatchesShipping, int accountAgeDays) {
        int score = priorChargebacks * 35;
        if (!billingMatchesShipping) {
            score += 20;
        }
        if (accountAgeDays < 7) {
            score += 15;
        }
        return Math.min(100, Math.max(0, score));
    }
}
""",
    "src/com/platform/ecommerce/payment/PaymentGatewayService.java": """package com.platform.ecommerce.payment;

/**
 * Refactored payment gateway service with simplified currency routing and Javadoc documentation.
 */
public class PaymentGatewayService {
    private final String primaryProvider = "STRIPE_GLOBAL";
    private final String backupProvider = "ADYEN_ENTERPRISE";

    /**
     * Authorizes a payment transaction for supported currencies.
     */
    public String authorizeTransaction(String transactionId, double amount, String currency, boolean allowFallback) {
        if (transactionId == null || amount <= 0.0 || currency == null) {
            return "REJECTED_INVALID_INPUT";
        }
        if (isPrimaryCurrency(currency)) {
            return "AUTHORIZED_" + primaryProvider + "_" + transactionId;
        }
        if (allowFallback) {
            return "AUTHORIZED_" + backupProvider + "_" + transactionId;
        }
        return "UNSUPPORTED_CURRENCY";
    }

    private boolean isPrimaryCurrency(String currency) {
        return "USD".equals(currency) || "EUR".equals(currency) || "GBP".equals(currency) || "INR".equals(currency);
    }

    /**
     * Computes payment processing fee based on card type and cross-border flag.
     */
    public double calculateGatewayFee(double amount, String cardNetwork, boolean international) {
        double rate = "AMEX".equals(cardNetwork) ? 0.035 : 0.029;
        if (international) {
            rate += 0.012;
        }
        return (amount * rate) + 0.30;
    }
}
""",
}


def ensure_sample_archives(data_dir: str) -> dict:
    """
    Create two real Java project ZIP archives in data_dir for immediate testing,
    upload demonstration, and Before-and-After refactoring comparison.
    """
    os.makedirs(data_dir, exist_ok=True)
    v1_path = os.path.join(data_dir, "ecommerce-order-engine-v1.zip")
    v2_path = os.path.join(data_dir, "ecommerce-order-engine-v2-refactored.zip")

    if not os.path.exists(v1_path):
        with zipfile.ZipFile(v1_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for rel_path, content in V1_JAVA_FILES.items():
                zf.writestr(rel_path, content)

    if not os.path.exists(v2_path):
        with zipfile.ZipFile(v2_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for rel_path, content in V2_JAVA_FILES.items():
                zf.writestr(rel_path, content)

    return {
        "v1": {
            "id": "v1",
            "filename": "ecommerce-order-engine-v1.zip",
            "path": v1_path,
            "project_name": "E-Commerce Order Engine",
            "version_label": "v1.0 - Initial Baseline (Pre-Refactoring)",
            "description": "Multi-package Java e-commerce backend containing a complex OrderProcessor God Class, nested conditionals, and payment routing logic.",
        },
        "v2": {
            "id": "v2",
            "filename": "ecommerce-order-engine-v2-refactored.zip",
            "path": v2_path,
            "project_name": "E-Commerce Order Engine",
            "version_label": "v2.0 - Refactored Architecture",
            "description": "Refactored revision of the E-Commerce Order Engine with decomposed helper methods, guard clauses, reduced coupling, and improved Javadoc coverage.",
        },
    }
