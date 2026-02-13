import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-amber-50">
      {/* Hero Section */}
      <header className="bg-green-800 text-white py-4 px-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Bobos Farm</h1>
          <nav className="flex gap-6">
            <Link href="/yurts" className="hover:text-green-200">Yurts</Link>
            <Link href="/login" className="hover:text-green-200">Login</Link>
            <Link href="/register" className="hover:text-green-200">Register</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center py-16">
          <h2 className="text-5xl font-bold text-green-800 mb-4">
            Welcome to Bobos Farm
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Experience authentic glamping in upstate New York
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/book/new" 
              className="bg-green-600 text-white px-8 py-3 rounded-full text-lg hover:bg-green-700"
            >
              Book Now
            </Link>
            <Link 
              href="/yurts" 
              className="border-2 border-green-600 text-green-600 px-8 py-3 rounded-full text-lg hover:bg-green-50"
            >
              View Yurts
            </Link>
          </div>
        </div>

        {/* Yurts Preview */}
        <div className="grid md:grid-cols-3 gap-8 py-16">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-48 bg-yellow-200 flex items-center justify-center">
              <span className="text-6xl">⛺</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">White Yurt</h3>
              <p className="text-gray-600">Classic white蒙古包 for a peaceful retreat</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-48 bg-red-200 flex items-center justify-center">
              <span className="text-6xl">⛺</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">Red Yurt</h3>
              <p className="text-gray-600">Warm red蒙古包 for cozy evenings</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-48 bg-yellow-400 flex items-center justify-center">
              <span className="text-6xl">⛺</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">Yellow Yurt</h3>
              <p className="text-gray-600">Bright yellow蒙古包 for sunny days</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="py-16">
          <h3 className="text-3xl font-bold text-center text-green-800 mb-12">
            Why Choose Bobos Farm?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🏕️</div>
              <h4 className="font-bold mb-2">Glamping</h4>
              <p className="text-gray-600">Luxury camping experience</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🍽️</div>
              <h4 className="font-bold mb-2">Fine Dining</h4>
              <p className="text-gray-600">Order meals to your yurt</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🌲</div>
              <h4 className="font-bold mb-2">Nature</h4>
              <p className="text-gray-600">Beautiful upstate scenery</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">📱</div>
              <h4 className="font-bold mb-2">Easy Booking</h4>
              <p className="text-gray-600">Simple online reservation</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-green-800 text-white py-8 text-center">
        <p>&copy; 2026 Bobos Farm. All rights reserved.</p>
      </footer>
    </div>
  );
}
