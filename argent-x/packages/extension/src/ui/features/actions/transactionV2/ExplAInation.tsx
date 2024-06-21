import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react"

import { useEffect, useState } from "react"

const fetchExplAInation = async () => {
  try {
    const response = await fetch("https://loripsum.net/api/3/medium/plaintext")
    if (!response.ok) {
      throw new Error("Communication error")
    }

    const data = await response.text()
    return data
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

  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button size="sm" onClick={onOpen}>
        ExplAIn
      </Button>

      <Modal onClose={onClose} isOpen={isOpen} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>ExplAInation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>{data}</ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default ExplAInation
