const User = require('../models/user')

exports.read = (req, res) => {
  const userId = req.params.id
  User.findById(userId).exec((err, user) => {
    if(err || !user) {
      return res.status(400).json({
        error: 'Usuário não encontrado'
      })
    }
    user.hashed_password = undefined
    user.salt = undefined

    res.json(user)
  })
}

exports.update = (req, res) => {
  // console.log('UPDATE USER - req.user', req.user, 'UPDATE DATA', req.body);
  const {name, password} = req.body

  User.findOne({_id: req.user._id}, (err,user) => {
    if(err || !user) {
      return res.status(400).json({
        error: 'Usuário não encontrado.'
      })
    }
    if(!name) {
      return res.status(400).json({
        error: 'O campo do nome não pode ficar vazio.'
      })
    } else {
      user.name = name
    }
    if(password){
      if(password.length < 6) {
        return res.status(400).json({
          error: 'A senha deve ter, no mínimo, 6 caracteres.'
        })
      } else {
        user.password = password
      }
    }

    user.save((err, updatedUser) => {
      if(err) {
        console.log('USER UPDATE ERROR', err);
        return res.status(400).json({
          error: 'A atualizaão do perfil falhou...'
        })
      }
      updatedUser.hashed_password = undefined
      updatedUser.salt = undefined
      res.json(updatedUser)
    })
  })
}
