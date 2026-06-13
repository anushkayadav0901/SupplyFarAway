import React from "react";

interface FeatureCardProps {
  icon?: React.ReactNode;
  title?: string;
  desc?: string;
  gradient?: string;
  iconBg?: string;
  iconColor?: string;
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}

const FeatureCard = ({
  icon,
  title = "Feature Title",
  desc = "Feature description goes here",
  gradient = "bg-blue-50/50 border-blue-200/50",
  iconBg = "bg-blue-100/70",
  iconColor = "text-blue-600",
  className = "",
  style = {},
}: FeatureCardProps) => {
  return (
    <div
      className={`relative overflow-hidden rounded-custom border border-slate-200/60 ${gradient} h-16 w-full max-w-xs sm:max-w-sm md:max-w-md ${className}`}
      style={style}
    >
      <div className="relative h-full flex items-center px-3 sm:px-4 gap-3 sm:gap-4">
        <div
          className={`flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 ${iconBg} ${iconColor} rounded-full flex items-center justify-center border border-slate-200/40`}
        >
          <span className="text-lg flex items-center justify-center">{icon}</span>
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
          <h3 className="text-slate-800 font-medium text-sm sm:text-base leading-none truncate mb-1 text-left">
            {title}
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm leading-none truncate text-left">
            {desc}
          </p>
        </div>

      </div>
    </div>
  );
};

export default FeatureCard;
