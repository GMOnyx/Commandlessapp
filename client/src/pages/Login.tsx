import { SignIn } from "@clerk/clerk-react";
import { BotIcon } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center">
          <BotIcon className="h-10 w-10 text-primary mr-2" />
          <h1 className="text-3xl font-bold text-gray-900">Commandless</h1>
        </div>
        <p className="mt-2 text-gray-600">Transform command-based bots into conversational AI</p>
      </div>
      
      <div className="w-full max-w-md">
        <SignIn 
          routing="hash"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "shadow-lg",
            }
          }}
        />
      </div>
    </div>
  );
}
