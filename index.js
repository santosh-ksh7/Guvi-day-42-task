import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from "dotenv";
import cors from "cors";

const app = express();


app.use(express.json());


app.use(cors());


dotenv.config();


// const mongo_url = "mongodb://127.0.0.1";
const mongo_url = process.env.mongo_url;


async function createConnection(){
  const client = new MongoClient(mongo_url);
  await client.connect();
  console.log("MongoDB is connected");
  return client;
}


const client = await createConnection();


// Welcome message
app.get('/', function (req, res) {
  res.send('Hello')
})


// Add mentors to DB
app.post("/add-mentors", async function(req,res){
  let data = req.body;
  data = {...data, "assigned_students" : []}
  const find_in_db = await client.db("day-n").collection("mentors").findOne({mentor_name: data.mentor_name});
  // Only add the mentor if it doesn't already exist
  if(find_in_db){
    res.status(400).send("Mentor with this name already exists");
  }else{
    const result = await client.db("day-n").collection("mentors").insertOne(data);
    res.status(200).send(result);
  }
})


// Add students to DB
app.post("/add-students", async function(req,res){
  let data = req.body;
  const find_in_db = await client.db("day-n").collection("students").findOne({student_name: data.student_name});
  // Only add the student if it doesn't already exist
  if(find_in_db){
    res.status(400).send("student with this name already exists");
  }else{
    const result = await client.db("day-n").collection("students").insertOne(data);
    res.status(200).send(result);
  }
})


// Assigning a mentor to students
app.put("/assign-mentor-to-students", async function(req,res){
  let data = req.body;
  let stud_to_add = data.assigned_students;
  const find_in_db = await client.db("day-n").collection("mentors").findOne({mentor_name: data.mentor_name});
  if(find_in_db){
    let stud_present_check;
    for(let x of stud_to_add){
      const res11 = await client.db("day-n").collection("students").findOne({student_name: x, assigned_mentor: {$exists : false}});
      if(res11){
        stud_present_check = true;
        continue
      }else{
        stud_present_check = false;
        break
      }
    }
    if(stud_present_check){
      const result11 = await client.db("day-n").collection("mentors").updateOne({mentor_name: data.mentor_name}, {$addToSet: {"assigned_students" : {$each : data.assigned_students}}});                    
      res.send("Succesfully updated mentors");
      for(let x of stud_to_add){
        await client.db("day-n").collection("students").updateOne({student_name: x}, {$set: {assigned_mentor: data.mentor_name}});
      }
    }else{
      res.status(400).send("Any of the student doesn't exist or studenty is already assigned a mentor")
    }
  }else{
    res.status(400).send("Mentor doesn't exist")
  }
})


//  API to Assign or Change Mentor for particular Student
app.put("/update-or-assign-mentor-to-student", async function(req,res){
  let data = req.body;
  const if_mentor_already_assigned = await client.db("day-n").collection("students").findOne({student_name: data.student_name});
  const if_mentor_exist = await client.db("day-n").collection("mentors").findOne({mentor_name: data.mentor_name});
  if(if_mentor_already_assigned && if_mentor_exist){
    if(if_mentor_already_assigned.assigned_mentor){
      let existing_mentor = if_mentor_already_assigned.assigned_mentor;
      await client.db("day-n").collection("students").updateOne({student_name: data.student_name}, {$set: {assigned_mentor : data.mentor_name}});
      await client.db("day-n").collection("mentors").updateOne({mentor_name: existing_mentor}, { $pull: { "assigned_students": data.student_name }});
      await client.db("day-n").collection("mentors").updateOne({mentor_name: data.mentor_name}, {$push: {"assigned_students" : data.student_name}})
      res.send("succesfully updated mentor")
    }else{
      await client.db("day-n").collection("students").updateOne({student_name: data.student_name}, {$set: {assigned_mentor : data.mentor_name}});
      await client.db("day-n").collection("mentors").updateOne({mentor_name: data.mentor_name}, {$push: {"assigned_students" : data.student_name}})
      res.send("succesfully assigned mentor")
    }
  }else{
    res.send("Either mentor or student not exist")
  }
})


// API to show all students for a particular mentor
app.get("/all-students-assigned-to-mentor", async function(req,res){
  let data = req.body;
  const check_if_mentor_exist = await client.db("day-n").collection("mentors").findOne({mentor_name: data.mentor_name});
  if(check_if_mentor_exist){
    res.send(check_if_mentor_exist.assigned_students);
  }else{
    res.send("No mentor with thsi name exist");
  }
})


app.listen(process.env.PORT)