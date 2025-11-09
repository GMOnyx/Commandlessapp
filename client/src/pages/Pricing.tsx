import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Price IDs - set these in your environment variables or update directly
// Get these from Stripe Dashboard → Products → Your Product → Prices
// IMPORTANT: These must be full Stripe Price IDs (e.g., "price_123ABC..."), NOT just numbers!
// Each price ID handles both the base subscription AND metered usage (configured in Stripe with tiers)
const PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_PRICE_STARTER || "price_1SQTN5I5bsNf9HQ8budTecEE", // Replace with your Starter price ID from Stripe
  growth: import.meta.env.VITE_STRIPE_PRICE_GROWTH || "price_1SQTZWI5bsNf9HQ8MByokHG2", // Replace with your Growth price ID from Stripe
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO || "price_1SQTZWI5bsNf9HQ8YWvAvWVd", // Replace with your Pro price ID from Stripe
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    period: "per month",
    description: "Perfect for getting started",
    features: [
      "15k requests included",
      "$0.0006 per additional request",
      "AI-only integration",
      "Basic support",
    ],
    priceId: PRICE_IDS.starter,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$49",
    period: "per month",
    description: "For growing communities",
    features: [
      "100k requests included",
      "$0.0005 per additional request",
      "AI-only integration",
      "Priority support",
    ],
    priceId: PRICE_IDS.growth,
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$199",
    period: "per month",
    description: "For power users",
    features: [
      "500k requests included",
      "$0.0004 per additional request",
      "AI-only integration",
      "Dedicated support",
    ],
    priceId: PRICE_IDS.pro,
  },
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCheckout = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    setLoading(planId);
    try {
      const response = await apiRequest("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          priceId: plan.priceId,
        }),
      });

      if (response.url) {
        window.location.href = response.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Pricing Plans</h1>
        <p className="text-xl text-gray-600">
          Choose the plan that fits your needs. All plans include usage-based billing after included requests.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.popular ? "border-primary shadow-lg scale-105" : ""}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-600 ml-2">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Get Started"
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center text-gray-600">
        <p>
          Need help choosing?{" "}
          <a href="mailto:support@commandless.app" className="text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}

