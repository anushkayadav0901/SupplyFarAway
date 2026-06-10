import React from "react";

interface AppleStyleSideBackgroundProps {
  children: React.ReactNode;
}

const AppleStyleSideBackground: React.FC<AppleStyleSideBackgroundProps> = ({ children }) => {
  return (
    <div className="bg-gray-50 min-h-screen">
      {children}
    </div>
  );
};

export default AppleStyleSideBackground;
