import { SignUp } from "@clerk/clerk-react";
import logo from "@landing/assets/commandless-cropped.svg";

export default function SignUpPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center">
          <img src={logo} alt="Commandless" className="h-12 w-auto" />
        </div>
        
        <div className="mt-6">
          <SignUp 
          routing="hash"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "shadow-lg",
              formFieldInput: "focus:ring-2 focus:ring-primary focus:border-primary",
              headerTitle: "text-gray-900",
              headerSubtitle: "text-gray-600",
            },
            layout: {
              logoImageUrl: undefined,
              showOptionalFields: true,
            }
          }}
          />
        </div>
      </div>
    </div>
  );
} 