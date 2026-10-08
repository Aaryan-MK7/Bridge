import { API_URL } from "../config/api";
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const employeeIdParam = searchParams.get('employeeId');

    if (!tokenParam || !employeeIdParam) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setToken(tokenParam);
    setEmployeeId(employeeIdParam);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/employees/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          resetToken: token,
          newPassword,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (data.success) {
        setSuccess(data.message);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Network error. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (error && !token) {
    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <div className="w-full flex items-center justify-center relative bg-white bg-opacity-5 backdrop-blur-2xl">
          <div className="text-center">
            <div className="px-6 py-4 rounded bg-red-50 text-red-700 border border-red-200 max-w-md">
              <p className="font-medium">{error}</p>
              <button
                onClick={handleBackToLogin}
                className="mt-4 bg-[#9546F6] hover:bg-[#7b35c3] text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Half */}
      <div
        className="hidden md:flex md:w-1/2 items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #171D34 0%, #9546F6 100%)",
        }}
      >
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Set New Password</h1>
          <p className="text-xl opacity-90">Create a secure password for your account.</p>
        </div>
      </div>

      {/* Right Half - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center relative bg-white bg-opacity-5 backdrop-blur-2xl">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>

        {/* Form Content */}
        <div className="relative z-10 w-full max-w-md p-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#171d34] mb-2">Reset Password</h1>
            <p className="text-[#171d34] text-opacity-80">
              Enter your new password below.
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white border-opacity-20">
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Employee ID Display */}
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Employee ID:</strong> {employeeId}
                  </p>
                </div>

                {/* New Password */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-[#9546F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    placeholder="New Password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl text-[#171d34] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9546F6] focus:border-transparent backdrop-blur-sm transition-all duration-300"
                    required
                    minLength={6}
                  />
                </div>

                {/* Confirm Password */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-[#9546F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl text-[#171d34] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9546F6] focus:border-transparent backdrop-blur-sm transition-all duration-300"
                    required
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="px-4 py-2 rounded bg-red-50 text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#9546F6] hover:bg-[#7b35c3] disabled:bg-opacity-30 text-white font-semibold py-4 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <span>Reset Password</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Back to Login */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-[#9546F6] hover:text-[#7b35c3] text-sm font-medium transition-colors"
                  >
                    ← Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Success Message */}
                <div className="px-4 py-3 rounded bg-green-50 text-green-700 border border-green-200">
                  <p className="font-medium">{success}</p>
                  <p className="text-sm mt-2">Redirecting to login page...</p>
                </div>

                {/* Back to Login Button */}
                <button
                  onClick={handleBackToLogin}
                  className="w-full bg-[#9546F6] hover:bg-[#7b35c3] text-white font-semibold py-4 rounded-xl transition-all duration-300 shadow-lg"
                >
                  Go to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
