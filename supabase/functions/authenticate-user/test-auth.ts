import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const testPassword = 'admin123';
const storedHash = '$2b$10$rOiKNe1vtWC2/D4EbKnFvOXTCgZV8.lqWZLY.kQXS7YQK1KlKP.VG';

const isMatch = await bcrypt.compare(testPassword, storedHash);
console.log('Password match:', isMatch);
