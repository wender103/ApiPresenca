const express = require('express')
const bodyParser = require('body-parser')
const admin = require('firebase-admin')
const cors = require('cors')


const serviceAccount = require('./Assets/Json/musiverse-e89c0-firebase-adminsdk-lan8j-d90c98ef11.json')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

const app = express()
app.use(bodyParser.json())
app.use(cors())
const port = 4000
const db = admin.firestore()

let UsersPresences = []
let infosApi = {}

const serverTimestamp = admin.firestore.FieldValue.serverTimestamp()

function Checar_User_Online() {
    console.log('Checando perfil')
    const currentTime = new Date() // Obtenha o tempo atual
    
    for (let c = 0; c < UsersPresences.length; c++) {
        if (UsersPresences[c].Email != infosApi.email) {
            const lastScreenDate = new Date(UsersPresences[c].InfosUser.LastScreen.toDate())
            
            // Verificar se lastScreenDate é uma data válida
            if (!isNaN(lastScreenDate.getTime())) {
                const diferencaEmMilissegundos = currentTime.getTime() - lastScreenDate.getTime()
                const diferencaEmMinutos = Math.floor(diferencaEmMilissegundos / (1000 * 60))

                let darUpdadeUser = false
                let estado = 'Offline'

                //* Caso o user esteja online
                if(diferencaEmMinutos < 3 && !UsersPresences[c].InfosUser.Online) {
                    UsersPresences[c].InfosUser.Online = true
                    darUpdadeUser = true
                    estado = 'Online'

                    //* Caso o user esteja offline
                } else if(diferencaEmMinutos > 2 && UsersPresences[c].InfosUser.Online) {
                    UsersPresences[c].InfosUser.Online = false
                    UsersPresences[c].InfosUser.CorBackground = null
                    UsersPresences[c].InfosUser.Ouvindo = { ID: null }
                    darUpdadeUser = true
                }

                console.log(`----${UsersPresences[c].Email}, min: ${diferencaEmMinutos}, estado: ${estado}-----`)

                if(darUpdadeUser) {
                    console.log(`Atualizou o user: ${UsersPresences[c].Email}, min: ${diferencaEmMinutos}, estado: ${estado}`)
                    db.collection('Presence').doc(UsersPresences[c].Email).update(UsersPresences[c].InfosUser)
                }
                
            } else {
                console.log(`Erro: LastScreen não é uma data válida para o usuário ${UsersPresences[c].Email}`)
            }
        }
    }
}

app.post('/api/updatePresence', async (req, res) => {
    UsersPresences = []
    const { email, isOnline, listeningMusicId, colorimg } = req.body
    console.log(`Nova requisição de ${email}`)

    infosApi = { email, isOnline, listeningMusicId, colorimg }

    let checar_users = false
    db.collection('Presence').get().then((snapshot) => {
        snapshot.docs.forEach(Users => {
            let UserAtual = {
                Email: Users.id,
                InfosUser: Users.data()
            }

            UsersPresences.push(UserAtual)

            if (Users.id == email) {
                const infosUserAtual = {
                    LastScreen: serverTimestamp,
                    Online: isOnline,
                    CorBackground: colorimg
                }

                // Verificar se listeningMusicId está definido antes de adicioná-lo ao objeto
                if (listeningMusicId !== undefined && isOnline == true) {
                    infosUserAtual.Ouvindo = { ID: listeningMusicId }
                } else {
                    infosUserAtual.CorBackground = null
                    infosUserAtual.Ouvindo = { ID: null }
                }

                db.collection('Presence').doc(Users.id).update(infosUserAtual).then(() => {
                    res.status(200).send('Presença atualizada com sucesso')
                    if (isOnline) {
                        // console.log(`Usuário ${email} está online :)`)
                    } else {
                        // console.log(`Usuário ${email} está offline :(`)
                    }
                }).catch(error => {
                    console.error('Erro ao atualizar presença:', error)
                    res.status(500).send('Erro interno do servidor ao atualizar presença')
                })

            }

        })
        
        if(!checar_users) {
            checar_users = true
            Checar_User_Online()
        }
    })
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
