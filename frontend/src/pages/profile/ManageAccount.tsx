import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUser,
  FaTrash,
  FaCamera,
  FaCheckCircle,
  FaExclamationCircle,
  FaEdit,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import Toast from "./../../components/Toast";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface ToastProps {
  type: string;
  message: string;
}

interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface UserData {
  id?: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  profilePhoto: string;
  phoneNumber: string;
  companyName: string;
  companyAddress: CompanyAddress;
  taxId: string;
}

interface ProfileForm {
  phoneNumber: string;
  companyName: string;
  companyAddress: CompanyAddress;
  taxId: string;
}

const ManageAccount: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [deleteEmail, setDeleteEmail] = useState<string>("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });
  const [profileCompletion, setProfileCompletion] = useState<number | string>(0);
  const [isEditingUsername, setIsEditingUsername] = useState<boolean>(false);
  const [isEditingPassword, setIsEditingPassword] = useState<boolean>(false);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [localProfilePhoto, setLocalProfilePhoto] = useState<string>("");
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    phoneNumber: "",
    companyName: "",
    companyAddress: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    taxId: "",
  });
  const token = localStorage.getItem("token");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC queries and mutations
  const { data: meData, isLoading: loading, isError: meError, refetch: refetchMe } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
    enabled: !!token,
  });

  const updateUsernameMutation = trpc.auth.updateUsername.useMutation({
    onSuccess: (_data: unknown) => {
      setToastProps({ type: "success", message: "Username updated successfully!" });
      setIsEditingUsername(false);
      void refetchMe();
    },
    onError: (error: { message?: string }) => {
      setToastProps({ type: "error", message: error.message || "Failed to update username." });
    },
  });

  const updatePasswordMutation = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      setToastProps({ type: "success", message: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
      setIsEditingPassword(false);
    },
    onError: (error: { message?: string }) => {
      setToastProps({ type: "error", message: error.message || "Failed to update password." });
    },
  });

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setToastProps({ type: "success", message: "Profile updated successfully!" });
      setIsEditingProfile(false);
      void refetchMe();
    },
    onError: (error: { message?: string }) => {
      setToastProps({ type: "error", message: error.message || "Failed to update profile." });
    },
  });

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      setToastProps({ type: "success", message: "Account deleted successfully!" });
      // Remove token immediately so any tab in the same origin stops
      // sending authenticated requests.
      localStorage.removeItem("token");
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => {
        navigate("/");
      }, 1500);
    },
    onError: (error: { message?: string }) => {
      setToastProps({ type: "error", message: error.message || "Failed to delete account." });
    },
  });

  const user = meData?.user;

  const calculateProfileCompletion = (userData: Partial<UserData>): void => {
    const fields = [
      userData.firstName,
      userData.lastName,
      userData.emailAddress,
      userData.phoneNumber,
      userData.companyName,
      userData.companyAddress?.street,
      userData.taxId,
      userData.profilePhoto,
    ];
    const filledFields = fields.filter(
      (field) => field && (field as string).trim() !== ""
    ).length;
    const completionPercentage = (filledFields / fields.length) * 100;
    setProfileCompletion(completionPercentage.toFixed(0));
  };

  // Initialize form fields from server data
  useEffect(() => {
    if (!user) return;

    setNewUsername(
      `${user.firstName || ""} ${user.lastName || ""}`.trim()
    );

    setProfileForm({
      phoneNumber: (user as any).phoneNumber || "",
      companyName: (user as any).companyName || "",
      companyAddress: {
        street: (user as any).companyAddress?.street || "",
        city: (user as any).companyAddress?.city || "",
        state: (user as any).companyAddress?.state || "",
        postalCode: (user as any).companyAddress?.postalCode || "",
        country: (user as any).companyAddress?.country || "",
      },
      taxId: (user as any).taxId || "",
    });

    setLocalProfilePhoto(user.profilePhoto || "");
    calculateProfileCompletion(user as unknown as UserData);
  }, [user]);

  const handleUpdateUsername = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const [firstName, ...lastNameParts] = newUsername.trim().split(" ");
    const lastName = lastNameParts.join(" ") || undefined;
    updateUsernameMutation.mutate({ firstName, lastName });
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToastProps({ type: "error", message: "Passwords do not match." });
      return;
    }
    // Backend enforces min 8 chars — match here to avoid round-trip failure.
    if (!newPassword || newPassword.length < 8) {
      setToastProps({
        type: "error",
        message: "Password must be at least 8 characters long.",
      });
      return;
    }
    updatePasswordMutation.mutate({ newPassword });
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleDeleteAccount = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (deleteEmail !== user?.emailAddress) {
      setToastProps({
        type: "error",
        message: "Email does not match. Please enter your correct email.",
      });
      return;
    }
    // Final irreversible-action confirmation. window.confirm is keyboard
    // accessible and announced by screen readers.
    const ok = window.confirm(
      "This will permanently delete your account and all associated data. This cannot be undone. Continue?",
    );
    if (!ok) return;
    deleteAccountMutation.mutate();
  };

  // Client-side guards must mirror the server multer config so we don't
  // waste a 10MB upload only to be rejected on the backend.
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const ALLOWED_PHOTO_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

  // Legacy: photo upload stays as axios (POST /api/user/upload-photo is a multipart/form-data endpoint via multer)
  const handlePhotoUpload = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!profilePhoto) {
      setToastProps({
        type: "error",
        message: "Please select a photo to upload.",
      });
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(profilePhoto.type)) {
      setToastProps({
        type: "error",
        message: "Only JPEG, PNG, WebP, or GIF images are allowed.",
      });
      return;
    }
    if (profilePhoto.size > MAX_PHOTO_BYTES) {
      setToastProps({
        type: "error",
        message: "File too large. Maximum allowed size is 10 MB.",
      });
      return;
    }
    const formData = new FormData();
    formData.append("photo", profilePhoto);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/user/upload-photo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setLocalProfilePhoto(response.data.signedUrl);
      setPreviewPhoto(null);
      setProfilePhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      calculateProfileCompletion({
        ...(user as unknown as UserData),
        profilePhoto: response.data.signedUrl,
      });
      setToastProps({
        type: "success",
        message: "Profile photo uploaded successfully!",
      });
      void refetchMe();
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to upload profile photo.";
      setToastProps({ type: "error", message: errorMessage });
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke any previous object URL to avoid leaking memory when the
      // user re-selects a different file before uploading.
      setPreviewPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setProfilePhoto(file);
    }
  };

  // Revoke the preview object URL on unmount so it isn't held forever.
  useEffect(() => {
    return () => {
      if (previewPhoto) URL.revokeObjectURL(previewPhoto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelEdit = (section: "username" | "password" | "profile"): void => {
    if (section === "username") {
      setNewUsername(`${user?.firstName} ${user?.lastName || ""}`.trim());
      setIsEditingUsername(false);
    } else if (section === "password") {
      setNewPassword("");
      setConfirmPassword("");
      setIsEditingPassword(false);
    } else if (section === "profile") {
      setProfileForm({
        phoneNumber: (user as any)?.phoneNumber || "",
        companyName: (user as any)?.companyName || "",
        companyAddress: {
          street: (user as any)?.companyAddress?.street || "",
          city: (user as any)?.companyAddress?.city || "",
          state: (user as any)?.companyAddress?.state || "",
          postalCode: (user as any)?.companyAddress?.postalCode || "",
          country: (user as any)?.companyAddress?.country || "",
        },
        taxId: (user as any)?.taxId || "",
      });
      setIsEditingProfile(false);
    }
  };

  const handleProfileFormChange = (field: string, value: string): void => {
    if (field.startsWith("companyAddress.")) {
      const addressField = field.split(".")[1];
      setProfileForm({
        ...profileForm,
        companyAddress: {
          ...profileForm.companyAddress,
          [addressField]: value,
        },
      });
    } else {
      setProfileForm({
        ...profileForm,
        [field]: value,
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.2, ease: "easeOut", staggerChildren: 0.05 },
    },
    exit: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } },
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15, ease: "easeOut" } },
  };

  if (meError) {
    return (
      <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
        <Header title="Manage Account" />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-red-600 text-lg mb-4">Could not load your account. Please refresh.</p>
          <button
            onClick={() => void refetchMe()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      <Header title="Manage Account" />
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="manage-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse"
          >
            <div className="h-9 bg-gray-200 rounded w-48 mb-8" />
            {/* Profile completion skeleton */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
              <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
              <div className="h-3 bg-gray-200 rounded-full mb-4" />
              <div className="h-4 bg-gray-100 rounded w-80" />
            </div>
            {/* User info skeleton */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-gray-200 rounded w-40" />
                  <div className="h-4 bg-gray-100 rounded w-56" />
                </div>
              </div>
            </div>
            {/* Form sections skeleton */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
                <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
                <div className="h-10 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </motion.div>
        ) : (
        <motion.div
          key="manage-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Manage Account
          </h1>

          {/* Profile Completion */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Profile Completion
                </h2>
                <span className="text-lg font-medium text-blue-600">
                  {profileCompletion}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-blue-500 h-3 rounded-full"
                  style={{ width: `${profileCompletion}%` }}
                ></div>
              </div>
              <p className="text-gray-600 text-sm">
                {Number(profileCompletion) < 100 ? (
                  <>
                    <FaExclamationCircle className="inline mr-1 text-yellow-500" />
                    Finish setting up your profile so we can offer more
                    personalized suggestions and features.
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="inline mr-1 text-green-500" />
                    Your profile is fully complete! Great job!
                  </>
                )}
              </p>
            </div>
          </motion.div>

          {/* User Info and Photo */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  {localProfilePhoto ? (
                    <img
                      src={localProfilePhoto}
                      alt="Profile"
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-full object-cover shadow-lg"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder-image.jpg";
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <FaUser className="text-4xl text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {user?.firstName} {user?.lastName || ""}
                  </h2>
                  <p className="text-gray-600">{user?.emailAddress}</p>
                </div>
              </div>

              {/* Photo Upload - LEGACY: uses multipart/form-data via axios */}
              <form onSubmit={handlePhotoUpload} className="mt-6">
                <label
                  htmlFor="profile-photo-input"
                  className="block text-gray-700 font-medium mb-2"
                >
                  Upload Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  <input
                    id="profile-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoChange}
                    ref={fileInputRef}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {/* Reserve space so file-input row doesn't shift when preview appears */}
                  <div className="w-16 h-16 rounded-full flex-shrink-0 overflow-hidden bg-gray-100">
                    {previewPhoto && (
                      <img
                        src={previewPhoto}
                        alt="Preview"
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-sm"
                >
                  <FaCamera /> Upload Photo
                </motion.button>
              </form>
            </div>
          </motion.div>

          {/* Update Username */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Update Username
                </h2>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsEditingUsername(true)}
                  style={{ visibility: isEditingUsername ? "hidden" : "visible" }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                  aria-hidden={isEditingUsername}
                >
                  <FaEdit /> Update
                </motion.button>
              </div>
              <form onSubmit={handleUpdateUsername}>
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={!isEditingUsername}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                {isEditingUsername && (
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-sm"
                    >
                      <FaSave /> Save
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => handleCancelEdit("username")}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl shadow-sm"
                    >
                      <FaTimes /> Cancel
                    </motion.button>
                  </div>
                )}
              </form>
            </div>
          </motion.div>

          {/* Profile Information */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Profile Information
                </h2>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsEditingProfile(true)}
                  style={{ visibility: isEditingProfile ? "hidden" : "visible" }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                  aria-hidden={isEditingProfile}
                >
                  <FaEdit /> Update
                </motion.button>
              </div>
              {isEditingProfile ? (
                <form onSubmit={handleUpdateProfile}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={profileForm.phoneNumber}
                        onChange={(e) =>
                          handleProfileFormChange("phoneNumber", e.target.value)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.companyName}
                        onChange={(e) =>
                          handleProfileFormChange("companyName", e.target.value)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={profileForm.companyAddress.street}
                        onChange={(e) =>
                          handleProfileFormChange(
                            "companyAddress.street",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter street address"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={profileForm.companyAddress.city}
                        onChange={(e) =>
                          handleProfileFormChange(
                            "companyAddress.city",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        value={profileForm.companyAddress.state}
                        onChange={(e) =>
                          handleProfileFormChange(
                            "companyAddress.state",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter state"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={profileForm.companyAddress.postalCode}
                        onChange={(e) =>
                          handleProfileFormChange(
                            "companyAddress.postalCode",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter postal code"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        Country
                      </label>
                      <input
                        type="text"
                        value={profileForm.companyAddress.country}
                        onChange={(e) =>
                          handleProfileFormChange(
                            "companyAddress.country",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter country"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">
                        Tax ID
                      </label>
                      <input
                        type="text"
                        value={profileForm.taxId}
                        onChange={(e) =>
                          handleProfileFormChange("taxId", e.target.value)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter tax ID"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-sm"
                    >
                      <FaSave /> Save
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => handleCancelEdit("profile")}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl shadow-sm"
                    >
                      <FaTimes /> Cancel
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-700 font-medium">Phone Number:</p>
                    <p className="text-gray-600">
                      {(user as any)?.phoneNumber || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">Company Name:</p>
                    <p className="text-gray-600">
                      {(user as any)?.companyName || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">Street Address:</p>
                    <p className="text-gray-600">
                      {(user as any)?.companyAddress?.street || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">City:</p>
                    <p className="text-gray-600">
                      {(user as any)?.companyAddress?.city || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">State:</p>
                    <p className="text-gray-600">
                      {(user as any)?.companyAddress?.state || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">Postal Code:</p>
                    <p className="text-gray-600">
                      {(user as any)?.companyAddress?.postalCode || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">Country:</p>
                    <p className="text-gray-600">
                      {(user as any)?.companyAddress?.country || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium">Tax ID:</p>
                    <p className="text-gray-600">
                      {(user as any)?.taxId || "Not provided"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Update Password */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Update Password
                </h2>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsEditingPassword(true)}
                  style={{ visibility: isEditingPassword ? "hidden" : "visible" }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                  aria-hidden={isEditingPassword}
                >
                  <FaEdit /> Update
                </motion.button>
              </div>
              {isEditingPassword ? (
                <form onSubmit={handleUpdatePassword}>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-sm"
                    >
                      <FaSave /> Save
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => handleCancelEdit("password")}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl shadow-sm"
                    >
                      <FaTimes /> Cancel
                    </motion.button>
                  </div>
                </form>
              ) : null}
            </div>
          </motion.div>

          {/* Delete Account */}
          <motion.div variants={itemVariants}>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Delete Account
              </h2>
              <p className="text-red-600 mb-4">
                Warning: This action is irreversible. All your data will be
                permanently deleted.
              </p>
              <form onSubmit={handleDeleteAccount}>
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">
                    Enter your email to confirm
                  </label>
                  <input
                    type="email"
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl shadow-sm"
                >
                  <FaTrash /> Delete Account
                </motion.button>
              </form>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default ManageAccount;
