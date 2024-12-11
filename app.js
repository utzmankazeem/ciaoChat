import express from "express"
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"
const app = express()

app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, () => {
        console.log(`listen on port http://localhost:${PORT}`)
})

//state as db
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false 
        :["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})
 
io.on('connection', socket => {
     //to connected user
    socket.emit('message', buildMsg(ADMIN, "welcome to ciao chat"))

    socket.on('enterRoom', ({ name, room}) =>{
        //leave prev room
        const prevRoom = getUser(socket.id)?.room

        if(prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`))
        }

        const user = activateUser(socket.id, name, room)

        //to update room list after userleaves
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUserInRoom(prevRoom)
            })
        }
        //join Room
        socket.join(user.room)

        //To user who join
        socket.emit('message', buildMsg(ADMIN, `You\'ve joined the ${user.room} chat room`))

        //to all others
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

        //update userList for room
        io.to(user.room).emit('userList', {
           users: getUserInRoom(user.room)
        })

        //update roomList for all
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    }) 

    //disconnected user - msg to all
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)

        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))

            io.to(user.room).emit('userList', {
                users: getUserInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`User ${socket.id} disconnected`)
    })

    //listen for msg events
    socket.on('message', ({name, text}) => {
        const room = getUser(socket.id)?.room
        if(room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
    })

    //listen for activity 
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if(room) {
        socket.broadcast.to(room).emit('activity', name) 
        }
    }) 
})

    //building the app
    function buildMsg(name, text) {
        return {
            name,
            text,
            time: new Intl.DateTimeFormat('default', {
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            }).format(new Date())
        }
    }

    //user func
    function activateUser(id, name, room) {
        const user = {id, name, room}
        UsersState.setUsers([
            ...UsersState.users.filter(user => user.id !== id ),
            user
        ])
        return user
    }    
    //user leave
    function userLeavesApp(id) {
        UsersState.setUsers(
            UsersState.users.filter(user => user.id !== id)
        )
    }
    function getUser(id) {
        return UsersState.users.find(user => user.id ===id)
    }

    function getUserInRoom(room) {
        return UsersState.users.filter(user => user.room === room)
    }
    //all room without duplicates
    function getAllActiveRooms() {
        return Array.from(new Set(UsersState.users.map(user => user.room)))
    }