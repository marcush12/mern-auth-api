const { check } = require('express-validator');

exports.userSignupValidator = [
  check('name')
    .not()
    .isEmpty()
    .withMessage('Nome é obrigatório'),
  check('email')
    .isEmail()
    .withMessage('Insira um email válido'),
  check('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve conter pelo menos 6 caracteres.')
];

exports.userSigninValidator = [
  check('email')
    .isEmail()
    .withMessage('Insira um email válido'),
  check('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve conter pelo menos 6 caracteres.')
];


exports.forgotPasswordValidator = [
  check('email')
    .not()
    .isEmpty()
    .isEmail()
    .withMessage('Insira um email válido'),
];

exports.resetPasswordValidator = [
  check('newPassword')
    .not()
    .isEmpty()
    .isLength({min: 6})
    .withMessage('Sua senha deve conter pelo menos 6 caracteres.'),
];