import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
import { toast } from "react-toastify";
import { trpc } from "../../lib/trpc";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface ProfileForm {
  phoneNumber: string;
  companyName: string;
  companyAddress: CompanyAddress;
  taxId: string;
}

const ManageAccount: React.FC = () => {
  const navigate = useNavigate();
  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [deleteEmail, setDeleteEmail] = useState<string>("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<number>(0);
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

  const { data: meData, isLoading: loading, isError: meError, refetch: refetchMe } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
    enabled: !!token,
  });

  const updateUsernameMutation = trpc.auth.updateUsername.useMutation({
    onSuccess: () => {
      toast.success("Username updated successfully!");
      setIsEditingUsername(false);
      void refetchMe();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update username.");
    },
  });

  // Backend updatePassword only accepts { newPassword } — no currentPassword field
  const updatePasswordMutation = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setIsEditingPassword(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update password.");
    },
  });

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      setIsEditingProfile(false);
      void refetchMe();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile.");
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
      toast.success("Account deleted successfully!");
      localStorage.removeItem("token");
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => {
        navigate("/");
      }, 1500);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete account.");
    },
  });

  const user = meData?.user;

  const calculateProfileCompletion = (u: typeof user): void => {
    if (!u) return;
    const fields = [
      u.firstName,
      u.lastName,
      u.emailAddress,
      (u as any).phoneNumber,
      (u as any).companyName,
      (u as any).companyAddress?.street,
      (u as any).taxId,
      u.profilePhoto,
    ];
    const filled = fields.filter((f) => f && String(f).trim() !== "").length;
    setProfileCompletion(Math.round((filled / fields.length) * 100));
  };

  useEffect(() => {
    if (!user) return;
    setNewUsername(`${user.firstName || ""} ${user.lastName || ""}`.trim());
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
    calculateProfileCompletion(user);
  }, [user]);

  const handleUpdateUsername = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const [firstName, ...rest] = newUsername.trim().split(" ");
    const lastName = rest.join(" ") || undefined;
    updateUsernameMutation.mutate({ firstName, lastName });
  };

  const handleUpdatePassword = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    // Backend only accepts { newPassword } — no currentPassword
    updatePasswordMutation.mutate({ newPassword });
  };

  const handleUpdateProfile = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleDeleteAccount = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (deleteEmail !== user?.emailAddress) {
      toast.error("Email does not match. Please enter your correct email.");
      return;
    }
    const ok = window.confirm(
      "This will permanently delete your account and all associated data. This cannot be undone. Continue?"
    );
    if (!ok) return;
    deleteAccountMutation.mutate();
  };

  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

  const handlePhotoUpload = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!profilePhoto) { toast.error("Please select a photo to upload."); return; }
    if (!ALLOWED_PHOTO_TYPES.has(profilePhoto.type)) { toast.error("Only JPEG, PNG, WebP, or GIF images are allowed."); return; }
    if (profilePhoto.size > MAX_PHOTO_BYTES) { toast.error("File too large. Maximum allowed size is 10 MB."); return; }
    const formData = new FormData();
    formData.append("photo", profilePhoto);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/user/upload-photo`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setLocalProfilePhoto(response.data.signedUrl);
      setPreviewPhoto(null);
      setProfilePhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Profile photo uploaded successfully!");
      void refetchMe();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to upload profile photo.");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setProfilePhoto(file);
    }
  };

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
    } else {
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
      const addrField = field.split(".")[1];
      setProfileForm((prev) => ({
        ...prev,
        companyAddress: { ...prev.companyAddress, [addrField]: value },
      }));
    } else {
      setProfileForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  if (meError) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600 text-base mb-4">Could not load your account. Please refresh.</p>
        <button
          onClick={() => void refetchMe()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 h-28" />
        <div className="bg-white rounded-2xl border border-slate-200 p-6 h-40" />
        <div className="bg-white rounded-2xl border border-slate-200 p-6 h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Profile Completion */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">Profile Completion</h2>
          <span className="text-sm font-semibold text-blue-600">{profileCompletion}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${profileCompletion}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          {profileCompletion < 100 ? (
            <><FaExclamationCircle className="inline mr-1 text-yellow-500" />Complete your profile to unlock personalized features.</>
          ) : (
            <><FaCheckCircle className="inline mr-1 text-emerald-500" />Profile is fully complete!</>
          )}
        </p>
      </div>

      {/* User Info and Photo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
          <div className="relative flex-shrink-0">
            {localProfilePhoto ? (
              <img src={localProfilePhoto} alt="Profile" width={80} height={80}
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder-image.jpg"; }}
              />
            ) : (
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
                <FaUser className="text-3xl text-white" />
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-slate-800">{user?.firstName} {user?.lastName || ""}</h2>
            <p className="text-sm text-slate-500">{user?.emailAddress}</p>
          </div>
        </div>
        {/* Photo Upload */}
        <form onSubmit={handlePhotoUpload}>
          <label htmlFor="profile-photo-input" className="block text-xs font-semibold text-slate-600 mb-2">
            Upload Profile Photo
          </label>
          <div className="flex items-center gap-3">
            <input
              id="profile-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoChange}
              ref={fileInputRef}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-slate-100">
              {previewPhoto && <img src={previewPhoto} alt="Preview" width={48} height={48} className="w-full h-full object-cover" />}
            </div>
          </div>
          <button type="submit" className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
            <FaCamera /> Upload Photo
          </button>
        </form>
      </div>

      {/* Update Username */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-slate-800">Full Name</h2>
          {!isEditingUsername && (
            <button onClick={() => setIsEditingUsername(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
              <FaEdit /> Edit
            </button>
          )}
        </div>
        <form onSubmit={handleUpdateUsername}>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            disabled={!isEditingUsername}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="Enter your full name"
            required
          />
          {isEditingUsername && (
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={updateUsernameMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                <FaSave /> {updateUsernameMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => handleCancelEdit("username")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
                <FaTimes /> Cancel
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-slate-800">Business Profile</h2>
          {!isEditingProfile && (
            <button onClick={() => setIsEditingProfile(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
              <FaEdit /> Edit
            </button>
          )}
        </div>
        {isEditingProfile ? (
          <form onSubmit={handleUpdateProfile}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
              {[
                { label: "Phone Number", field: "phoneNumber", type: "tel", val: profileForm.phoneNumber },
                { label: "Company Name", field: "companyName", type: "text", val: profileForm.companyName },
                { label: "Street Address", field: "companyAddress.street", type: "text", val: profileForm.companyAddress.street },
                { label: "City", field: "companyAddress.city", type: "text", val: profileForm.companyAddress.city },
                { label: "State", field: "companyAddress.state", type: "text", val: profileForm.companyAddress.state },
                { label: "Postal Code", field: "companyAddress.postalCode", type: "text", val: profileForm.companyAddress.postalCode },
                { label: "Country", field: "companyAddress.country", type: "text", val: profileForm.companyAddress.country },
                { label: "Tax ID", field: "taxId", type: "text", val: profileForm.taxId },
              ].map(({ label, field, type, val }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input type={type} value={val}
                    onChange={(e) => handleProfileFormChange(field, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={updateProfileMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                <FaSave /> {updateProfileMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => handleCancelEdit("profile")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
                <FaTimes /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { label: "Phone", val: (user as any)?.phoneNumber },
              { label: "Company", val: (user as any)?.companyName },
              { label: "Street", val: (user as any)?.companyAddress?.street },
              { label: "City", val: (user as any)?.companyAddress?.city },
              { label: "State", val: (user as any)?.companyAddress?.state },
              { label: "Postal Code", val: (user as any)?.companyAddress?.postalCode },
              { label: "Country", val: (user as any)?.companyAddress?.country },
              { label: "Tax ID", val: (user as any)?.taxId },
            ].map(({ label, val }) => (
              <div key={label}>
                <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
                <p className="text-slate-700">{val || <span className="text-slate-400 italic">Not provided</span>}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update Password */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-slate-800">Password</h2>
          {!isEditingPassword && (
            <button onClick={() => setIsEditingPassword(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
              <FaEdit /> Change
            </button>
          )}
        </div>
        {isEditingPassword && (
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="At least 8 characters" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Confirm new password" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={updatePasswordMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                <FaSave /> {updatePasswordMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => handleCancelEdit("password")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
                <FaTimes /> Cancel
              </button>
            </div>
          </form>
        )}
        {!isEditingPassword && (
          <p className="text-xs text-slate-400">Password is hidden. Click Change to update.</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-100 p-6">
        <h2 className="text-base font-bold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-xs text-slate-500 mb-4">This action is irreversible. All your data will be permanently deleted.</p>
        <form onSubmit={handleDeleteAccount} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Enter your email to confirm</label>
            <input type="email" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="your@email.com" required />
          </div>
          <button type="submit" disabled={deleteAccountMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-xl transition-colors">
            <FaTrash /> {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
          </button>
        </form>
      </div>

    </div>
  );
};

export default ManageAccount;
