import { SignIn } from "@clerk/clerk-react";
import logo from "@landing/assets/commandless-cropped.svg";

export default function Login() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <div className="mb-8 w-full flex justify-center">
        <img src={logo} alt="Commandless" className="h-12 w-auto" />
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
