// Quick script to check which coach is logged in the browser
// This will help us understand why only 1 workout shows in UI

console.log('🔍 Browser Login Check');
console.log('Open your browser console and run this:');
console.log('');
console.log('// Check localStorage for auth token');
console.log('const token = localStorage.getItem("auth-token");');
console.log('if (token) {');
console.log('  const payload = JSON.parse(atob(token.split(".")[1]));');
console.log('  console.log("Logged in user ID:", payload.userId);');
console.log('  console.log("Role:", payload.role);');
console.log('} else {');
console.log('  console.log("No auth token found");');
console.log('}');
console.log('');
console.log('// Or check the user object in React DevTools');
console.log('// Look for the WorkoutManagement component props');
