import React from "react";

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="min-h-screen bg-[#f6f8fb]">{children}</div>;
};

export default ProtectedLayout;
