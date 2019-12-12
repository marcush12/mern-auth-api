const User = require('../models/user');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const _ = require('lodash');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch')

// sendgrid
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/* exports.signup = (req, res) => {
    //console.log('REQ BODY ON SIGNUP', req.body);
    const {name, email, password} = req.body

    User.findOne({email}).exec((err, user) => {
      if(user) {
        return res.status(400).json({
          error: 'Esse Email já existe'
        })
      }
    })

    let newUser = new User({name, email, password})

    newUser.save((err, success) => {
      if(err) {
        console.log('SIGNUP ERROR', err);
        return res.status(400).json({
          error: err
        })
      }

      res.json({
        message: 'Conta criada com sucesso! Por favor, faça o login.' 
      })
    })
} */

exports.signup = (req, res) => {
  const { name, email, password } = req.body;

  User.findOne({ email }).exec((err, user) => {
    if (user) {
      return res.status(400).json({
        error: 'Esse Email já existe'
      });
    }
    const token = jwt.sign(
      { name, email, password },
      process.env.JWT_ACCOUNT_ACTIVATION,
      { expiresIn: '1d' }
    );

    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Link para ativar sua conta`,
      html: `
        <h1>Por favor, clique no link seguinte para ativar sua conta</h1>
        <p>${process.env.CLIENT_URL}/auth/activate/${token}</p>
        <hr/>
        <p>Este email contém informações para você</p>
        <p>${process.env.CLIENT_URL}</p>
      `
    };

    sgMail.send(emailData).then(sent => {
      console.log('SIGNUP EMAIL SENT', sent);
      return res.json({
        message: `Um email foi enviado para ${email}. Siga as instruções para ativar sua conta`
      });
    });
  });
};

exports.accountActivation = (req, res) => {
  const { token } = req.body;
  if (token) {
    jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(
      err,
      decoded
    ) {
      if (err) {
        console.log('JWT VERIFY IN ACCOUNT ACTIVATION ERROR', err);
        return res.status(401).json({
          error: 'O Link expirou. Abra sua conta novamente.'
        });
      }
      const { name, email, password } = jwt.decode(token);

      const user = new User({ name, email, password });

      user.save((err, user) => {
        if (err) {
          console.log('SAVE USER IN ACCOUNT ACTIVATION ERROR!', err);
          return res.status(401).json({
            error: 'Error saving user in database. Tente novamente.'
          });
        }
        return res.json({
          message: 'Conta criada com sucesso! Por favor, faça seu login.'
        });
      });
    });
  } else {
    return res.json({
      message: 'Alguma coisa deu errado. Tente novamente.'
    });
  }
};

exports.signin = (req, res) => {
  const { email, password } = req.body;
  // check if user exist
  User.findOne({ email }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'User with that email does not exist. Please signup'
      });
    }
    // authenticate
    if (!user.authenticate(password)) {
      return res.status(400).json({
        error: 'Email and password do not match'
      });
    }
    // generate a token and send to client
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    const { _id, name, email, role } = user;

    return res.json({
      token,
      user: { _id, name, email, role }
    });
  });
};

exports.requireSignin = expressJwt({
  secret: process.env.JWT_SECRET // req.user
});

exports.adminMiddeware = (req, res, next) => {
  User.findById({ _id: req.user._id }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'Usuário não encontrado'
      });
    }
    if (user.role !== 'admin') {
      return res.status(400).json({
        error: 'Acesso não autorizado.'
      });
    }
    req.profile = user;
    next();
  });
};

exports.forgotPassword = (req, res) => {
  const { email } = req.body;

  User.findOne({ email }, (err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'Esse usuário não existe.'
      });
    }

    const token = jwt.sign(
      { _id: user._id, name: user.name },
      process.env.JWT_RESET_PASSWORD,
      {
        expiresIn: '10m'
      }
    );

    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Link alterar senha`,
      html: `
        <h1>Por favor, clique no link seguinte para alterar sua senha</h1>
        <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
        <hr/>
        <p>Este email contém informações para você</p>
        <p>${process.env.CLIENT_URL}</p>
      `
    };

    return user.updateOne({ resetPasswordLink: token }, (err, success) => {
      if (err) {
        console.log('RESET PASSWORD LINK ERROR', err);
        return res.status(400).json({
          error: 'Database connection error on user password forgot request'
        });
      } else {
        sgMail
          .send(emailData)
          .then(sent => {
            // console.log('SIGNUP EMAIL SENT', sent)
            return res.json({
              message: `Enviamos um Email para ${email}. Siga as instruções para activate your account`
            });
          })
          .catch(err => {
            // console.log('SIGNUP EMAIL SENT ERROR', err)
            return res.json({
              message: err.message
            });
          });
      }
    });
  });
};

exports.resetPassword = (req, res) => {
  const { resetPasswordLink, newPassword } = req.body;

  if (resetPasswordLink) {
    jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function(
      err,
      decoded
    ) {
      if (err) {
        return res.status(400).json({
          error: 'O link expirou. Tente novamente.'
        });
      }

      User.findOne({ resetPasswordLink }, (err, user) => {
        if (err || !user) {
          return res.status(400).json({
            error: 'Algo deu errado. Tente mais tarde.'
          });
        }

        const updatedFields = {
          password: newPassword,
          resetPasswordLink: ''
        };

        user = _.extend(user, updatedFields);

        user.save((err, result) => {
          if (err) {
            return res.status(400).json({
              error: 'Erro ao alterar a senha.'
            });
          }
          res.json({
            message: `Sucesso! Agora você pode fazer login com sua nova senha.`
          });
        });
      });
    });
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.googleLogin = (req, res) => {
  const { idToken } = req.body;

  client
    .verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
    .then(response => {
      // console.log('GOOGLE LOGIN RESPONSE',response)
      const { email_verified, name, email } = response.payload;
      if (email_verified) {
        User.findOne({ email }).exec((err, user) => {
          if (user) {
            const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
              expiresIn: '7d'
            });
            const { _id, email, name, role } = user;
            return res.json({
              token,
              user: { _id, email, name, role }
            });
          } else {
            let password = email + process.env.JWT_SECRET;
            user = new User({ name, email, password });
            user.save((err, data) => {
              if (err) {
                console.log('ERROR GOOGLE LOGIN ON USER SAVE', err);
                return res.status(400).json({
                  error: 'User signup failed with google'
                });
              }
              const token = jwt.sign(
                { _id: data._id },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
              );
              const { _id, email, name, role } = data;
              return res.json({
                token,
                user: { _id, email, name, role }
              });
            });
          }
        });
      } else {
        return res.status(400).json({
          error: 'Google login failed. Try again'
        });
      }
    });
};

exports.facebookLogin = (req, res) => {
  console.log('FACEBOOK LOGIN REQ BODY', req.body);
  const { userID, accessToken } = req.body;

  const url = `https://graph.facebook.com/v2.11/${userID}/?fields=id,name,email&access_token=${accessToken}`;

  return (
      fetch(url, {
          method: 'GET'
      })
          .then(response => response.json())
          // .then(response => console.log(response))
          .then(response => {
              const { email, name } = response;
              User.findOne({ email }).exec((err, user) => {
                  if (user) {
                      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                      const { _id, email, name, role } = user;
                      return res.json({
                          token,
                          user: { _id, email, name, role }
                      });
                  } else {
                      let password = email + process.env.JWT_SECRET;
                      user = new User({ name, email, password });
                      user.save((err, data) => {
                          if (err) {
                              console.log('ERROR FACEBOOK LOGIN ON USER SAVE', err);
                              return res.status(400).json({
                                  error: 'User signup failed with facebook'
                              });
                          }
                          const token = jwt.sign({ _id: data._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                          const { _id, email, name, role } = data;
                          return res.json({
                              token,
                              user: { _id, email, name, role }
                          });
                      });
                  }
              });
          })
          .catch(error => {
              res.json({
                  error: 'Facebook login failed. Try later'
              });
          })
  );
};
