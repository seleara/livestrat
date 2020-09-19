const electron = require('electron')
const fs = require('fs')
const http = require('http')

var server

function listenForTriggers(win, projects) {
	server = http.createServer((req, res) => {
		if (req.method !== 'POST') {
			return
		}

		var body = ''
		req.on('data', data => {
			body += data
		})

		req.on('end', () => {
			console.log(body)

			var json = JSON.parse(body)
			console.log("Strat: " + json.strat)
			console.log("Slide: " + json.slide)

			if (!projects.hasOwnProperty(json.strat)) {
				console.log(`Error: Project '${json.strat}' is not loaded.`)
				return
			}

			var projectDef = projects[json.strat]

			if (!projectDef.project.hasOwnProperty('slides')) {
				console.log(`Error: Project '${json.strat}' does not contain any slides.`)
				return
			}

			if (!projectDef.project.slides.hasOwnProperty(json.slide)) {
				console.log(`Error: Project '${json.strat}' does not contain a slide with the ID '${json.slide}'.`)
				return
			}

			if (!projectDef.project.slides[json.slide].hasOwnProperty('image')) {
				console.log(`Error: Project '${json.strat}', slide '${json.slide}' does not have an associated image.`)
				return
			}

			var image = projectDef.project.slides[json.slide].image

			win.webContents.send('asynchronous-message', `${projectDef.path}/${image}`)

			res.writeHead(200, { 'Content-Type': 'text/json' })
			res.end('{ "status": "success" }')
		})
	})
	server.listen(65300)
	console.log("Server listening on port 65300.")
}

function reloadProjects(callback) {
	projects = {}

	fs.readdir('./projects', { withFileTypes: true }, (err, files) => {
		files.forEach(file => {
			if (!file.isDirectory()) {
				return
			}

			var projectFile = `./projects/${file.name}/project.json`

			if (!fs.existsSync(projectFile)) {
				console.log(`Error: Folder '${file.name}' does not contain a project.json file.`)
				return
			}

			try {
				var project = JSON.parse(fs.readFileSync(projectFile))

				console.log(`Loaded project '${project.id}'`)

				var projectDef = {}
				projectDef.path = `./projects/${file.name}`
				projectDef.project = project

				projects[projectDef.project.id] = projectDef
			} catch (err) {
				console.log(`Error parsing project file: ${err}`)
			}
		})

		callback(projects)
	})
}

function createWindow() {
	const win = new electron.BrowserWindow({
		width: 1280,
		height: 720,
		webPreferences: {
			nodeIntegration: true
		}
	})
	win.setMenuBarVisibility(false)

	win.loadFile('index.html')

	electron.ipcMain.on('reload-message', event => {
		console.log("Reload message received.")
		server.close(() => {
			console.log("Server stopped.")
			win.webContents.session.clearCache().then(() => {
				console.log("Cache cleared.")
				reloadProjects(projects => {
					console.log("Projects reloaded.")
					listenForTriggers(win, projects)
				})
			})
		})
	})

	reloadProjects(projects => {
		listenForTriggers(win, projects);
	})
}

electron.app.whenReady().then(createWindow)
