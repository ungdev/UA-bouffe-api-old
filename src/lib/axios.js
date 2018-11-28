import axios from 'axios'

export default axios.create({
  baseURL: `${process.env.ARENA_API_URL}/api/v1`
})