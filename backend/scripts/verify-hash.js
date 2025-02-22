const bcrypt = require('bcryptjs');

const password = 'admin123';
const storedHash = '$2a$12$rlF/lsnviWG2kABv0c0q5eoDYF99SetLJ4h1UcqwXgno7Pd3wTwae';

bcrypt.compare(password, storedHash).then(isMatch => {
  console.log('Password matches:', isMatch);
}); 