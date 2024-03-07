const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cors = require('cors'); // Importe o pacote cors

const app = express();
const port = 3000;

// Inicialize o Firebase Admin SDK
const serviceAccount = require('./Assets/Json/musiverse-e89c0-firebase-adminsdk-lan8j-d90c98ef11.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Aqui está a instância do Firestore
// Não há necessidade de inicializar a autenticação aqui, já que não é usada

app.use(cors()); // Defina o middleware cors aqui
app.use(bodyParser.json());

let hasUsersOnline = false; // Variável global para controlar se há usuários online

// Verifica a presença dos usuários a cada 2 minutos se houver usuários online
setInterval(() => {
    if (!hasUsersOnline) {
        console.log('Nenhum usuário online. Suspensão das verificações de presença.');
        return;
    }

    db.collection('Presence').where('Online', '==', true).get()
    .then(snapshot => {
        if (snapshot.empty) {
            console.log('Nenhum usuário online. Suspensão das verificações de presença.');
            hasUsersOnline = false;
            return;
        }

        snapshot.forEach(doc => {
            const userData = doc.data();
            const lastScreen = userData.LastScreen.toDate();
            const currentTime = new Date();
            const timeDifference = (currentTime - lastScreen) / (1000 * 60); // Diferença de tempo em minutos

            if (timeDifference > 5) {
                // Se o usuário não foi atualizado como online nos últimos 5 minutos, marque-o como offline
                const userPresenceRef = db.collection('Presence').doc(doc.id);
                userPresenceRef.update({ Online: false, Ouvindo: {ID: null} })
                .then(() => {
                    console.log(`Usuário ${doc.id} marcado como offline`);
                })
                .catch(error => {
                    console.error(`Erro ao marcar o usuário ${doc.id} como offline:`, error);
                });
            }
        });
    })
    .catch(error => {
        console.error('Erro ao verificar presença dos usuários:', error);
    });
}, 2 * 60 * 1000); // 2 minutos em milissegundos

// Endpoint para atualizar a presença do usuário
app.post('/api/updatePresence', async (req, res) => {
    const { email, isOnline, listeningMusicId } = req.body;

    var connectedRef = admin.firestore.FieldValue.serverTimestamp(); // Corrigido para admin.firestore

    // Log do email de quem fez a requisição
    console.log(`Requisição recebida de ${email}`);

    // Atualize a variável global hasUsersOnline com base no status de presença recebido
    hasUsersOnline = isOnline;

    // Obtém a referência do documento do usuário no Firestore
    const userPresenceRef = db.collection('Presence').doc(email);

    // Obtém o snapshot do documento para comparar as informações existentes
    const snapshot = await userPresenceRef.get();
    if (!snapshot.exists) {
        console.error(`Documento para o usuário ${email} não encontrado`);
        return res.status(404).send('Documento de usuário não encontrado');
    }

    const userData = snapshot.data();

    // Verifica se há mudanças nas informações antes de atualizar
    if (isOnline !== userData.Online || listeningMusicId !== userData.Ouvindo.ID) {
        let id_musica = null

        if(isOnline) {
            id_musica = listeningMusicId
        }

        const updateData = {
            Online: isOnline,
            LastScreen: connectedRef,
            Ouvindo: {
                ID: id_musica
            }
        };

        // Atualiza apenas se houver diferenças
        userPresenceRef.update(updateData)
        .then(() => {
            res.status(200).send('Presença atualizada com sucesso');
            if (isOnline) {
                console.log(`Usuário ${email} está online :)`);
            } else {
                console.log(`Usuário ${email} está offline :(`);
            }
        })
        .catch(error => {
            console.error('Erro ao atualizar presença:', error);
            res.status(500).send('Erro interno do servidor ao atualizar presença');
        });
    } else {
        console.log('Nenhuma alteração nas informações de presença do usuário');
        res.status(200).send('Nenhuma alteração nas informações de presença do usuário');
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
