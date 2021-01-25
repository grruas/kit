const { getEventListeners } = require("events")

prompt = async config => {
  console.log(`>>> APP PROMPT <<<`)

  let type = "input"
  if (config?.choices) {
    type = "autocomplete"
  }
  if (typeof config?.choices === "function") {
    type = "lazy"
  }

  config = {
    type,
    message: "Input:",
    name: "value",
    ...config,
  }

  if (typeof config?.choices === "object") {
    config = {
      ...config,
      choices: config.choices.map(choice => {
        if (typeof choice === "string") {
          return {
            name: choice,
            value: choice,
          }
        }
        return choice
      }),
    }
  }

  await getFrontMost()
  process.send({ ...config, from: "prompt" })

  let value = await new Promise((resolve, reject) => {
    let messageHandler = async data => {
      //The App is requesting to run the arg choices func
      // console.log("process.once('message'):", data)
      if (
        data?.from === "input" &&
        typeof config?.choices == "function"
      ) {
        process.send({
          from: "choices",
          choices: (await config.choices(data?.input)).map(
            choice => {
              if (typeof choice === "string") {
                return {
                  name: choice,
                  value: choice,
                }
              }
              return choice
            }
          ),
        })

        return
      }
      resolve(data)
    }

    let errorHandler = () => {
      reject()
    }

    process.once("message", messageHandler)
    process.once("error", errorHandler)
  })

  return value
}

arg = async (message = "Input", promptConfig = {}) => {
  if (args.length) return args.shift()
  return prompt({
    message,
    ...promptConfig,
  })
}

env = async (envKey, promptConfig = {}) => {
  if (env[envKey]) return env[envKey]

  let input = await prompt({
    message: `Set ${envKey} env to:`,
    ...promptConfig,
  })

  if (input.startsWith("~"))
    input = input.replace("~", env.HOME)

  await run("cli/set-env-var", envKey, input)
  env[envKey] = input
  return input
}

npm = async packageName => {
  try {
    return await import(packageName)
  } catch {
    if (!arg?.trust) {
      let installMessage = `${env.SIMPLE_SCRIPT_NAME}} needs to install the npm library: ${packageName}`

      let downloadsMessage = `${packageName} has had ${
        (
          await get(
            `https://api.npmjs.org/downloads/point/last-week/` +
              packageName
          )
        ).data.downloads
      } downloads from npm in the past week`

      let packageLink = `https://npmjs.com/package/${packageName}`
      let readMore = `
    Read more about ${packageName} here: ${packageLink}
    `

      let message = `Do you trust ${packageName}?`

      let config = {
        message,
        choices: [
          { name: "Yes", value: true },
          { name: "No", value: false },
        ],
      }

      config = {
        ...config,
        message,
        choices: config.choices.map(choice => {
          return {
            ...choice,
            info: `<div>
          <div>${installMessage}</div>
          <div>${downloadsMessage}</div>
          <div>${readMore}</div>
          </div>`,
          }
        }),
      }

      let trust = await prompt(config)
      if (!trust) {
        echo(`Ok. Exiting...`)
        exit()
      }
    }
    echo(
      chalk`Installing {yellow ${packageName}} and continuing.`
    )

    await install([packageName])
    let packageJson = require(simplePath(
      "node_modules",
      packageName,
      "package.json"
    ))

    return await import(
      simplePath(
        "node_modules",
        packageName,
        packageJson.main
      )
    )
  }
}