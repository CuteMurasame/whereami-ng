const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
    callbackURL: "/api/auth/google/callback"
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
      // 1. Try to find user by google_id
      let user = await User.findOne({ where: { google_id: profile.id } });
      
      if (user) {
        return cb(null, user);
      }

      // 2. If not found, we pass the profile info to the next step
      // We don't create the user yet because we need them to set a username/password
      return cb(null, {
          google_id: profile.id,
          email: profile.emails[0].value,
          is_new_google_user: true
      });

    } catch (err) {
      return cb(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
