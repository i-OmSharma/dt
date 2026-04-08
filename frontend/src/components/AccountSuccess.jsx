import { useLocation, Link } from "react-router-dom";

export const AccountSuccess = () => {
  const location = useLocation();
  const { accountNumber, email } = location.state || {};

  if (!accountNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-10 rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">No Account Found</h1>
          <p className="text-gray-600 mb-6">Please signup first.</p>
          <Link to="/" className="text-blue-600 font-semibold hover:underline">Go to Sign Up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">Account Created Successfully!</h1>
        <p className="text-gray-700 mb-2">Email: <span className="font-medium">{email}</span></p>
        <p className="text-gray-700 mb-6">Your Account Number is:</p>
        <h2 className="text-2xl font-bold text-blue-700 mb-8">{accountNumber}</h2>
        <Link
          to="/"
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
};