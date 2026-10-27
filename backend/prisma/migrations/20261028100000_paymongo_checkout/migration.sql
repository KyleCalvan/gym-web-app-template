ALTER TABLE "PaymentTransaction" ADD COLUMN "paymongoCheckoutId" TEXT;
CREATE UNIQUE INDEX "PaymentTransaction_paymongoCheckoutId_key" ON "PaymentTransaction"("paymongoCheckoutId");
