import React from "react";

interface ButtonProps {
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-start gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors duration-150 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      style={{ minWidth: "130px", height: "40px" }}
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        viewBox="0 0 512 512"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm50.7-186.9L162.4 380.6c-19.4 7.5-38.5-11.6-31-31l55.5-144.3c3.3-8.5 9.9-15.1 18.4-18.4l144.3-55.5c19.4-7.5 38.5 11.6 31 31L325.1 306.7c-3.2 8.5-9.9 15.1-18.4 18.4zM288 256a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z" />
      </svg>
      Inventory
    </button>
  );
};

export default Button;
