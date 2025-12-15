-- CreateTable
CREATE TABLE "CityPinCode" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pinCodes" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'static',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityPinCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityPinCode_city_key" ON "CityPinCode"("city");

-- CreateIndex
CREATE INDEX "CityPinCode_city_idx" ON "CityPinCode"("city");
