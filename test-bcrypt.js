const bcrypt = require('bcryptjs');

const testPassword = 'admin123';
const storedHash = '$2b$10$rOiKNe1vtWC2/D4EbKnFvOXTCgZV8.lqWZLY.kQXS7YQK1KlKP.VG';

bcrypt.compare(testPassword, storedHash, (err, isMatch) => {
  if (err) {
    console.error('Error during password verification:', err);
  } else {
    console.log('Password match:', isMatch);
  }
});
