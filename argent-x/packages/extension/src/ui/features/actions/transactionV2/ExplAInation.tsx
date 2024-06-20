import { AccordionPanel } from "@chakra-ui/react"
import { useEffect, useState } from "react"

const fetchExplAInation = async () => {
  try {
    const response = await fetch(
      "http://worldtimeapi.org/api/timezone/Europe/Madrid",
    )
    if (!response.ok) {
      throw new Error("Communication error")
    }
    console.log("PACO")
    const data = await response.json()
    console.log(data)
    return data.datetime
  } catch (error) {
    console.error(error)
    throw error
  }
}

const ExplAInation = () => {
  const [data, setData] = useState("Retrieving transaction explaination...")
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchExplAInation()
      .then((result) => {
        setData(result)
      })
      .catch((error) => {
        setError(error.message)
        setData(error.message)
      })
  }, [])

  return (
    <AccordionPanel>
      <p>{data}</p>
    </AccordionPanel>
  )
}

export default ExplAInation
