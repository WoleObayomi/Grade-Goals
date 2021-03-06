var gg = gg||{}

gg.parseTranscript = function(){
  var promise = new Promise(function(resolve,reject){
    //set ending marker
    var eoTrans = document.querySelectorAll("table.dataentrytable")[1];
    var lastTR = eoTrans.firstElementChild.lastElementChild;
    lastTR.setAttribute("gg-marker","eoTrans");
    gg.endMarker = lastTR;
    //we need some transcript info:
    //Current cGPA
    //Points
    //GPA Cr
    //This information is always in the last tr with a table child
    var details = {};
    var _infoContainer = document.querySelectorAll("tr table tbody");
    var infoContainer = Array.prototype.slice.call(_infoContainer,-1)[0].lastElementChild;
    var trParent = infoContainer.parentElement;
    //set marker on parent tr
    while(trParent.tagName !== "TR")
    {
        trParent = trParent.parentElement;
    }

    trParent.setAttribute("gg-marker","");
    gg.startMarker = trParent;
    var jumbledInfo = infoContainer.innerText;
    var splitInfo = jumbledInfo.match(/[a-z A-Z:0-9\.]+/g);
    //some hardcoding
    //from the back of the array since those values are not labelled
    details.points = splitInfo.pop();
    details.gpaCreds = splitInfo.pop();
    details.earnedCreds = splitInfo.pop();
    details.attCreds = splitInfo.pop();
    details.cumGPA = splitInfo[1];
    details.totalCreds = splitInfo[3];
    gg.transcript = details;
    resolve();
  });
  return promise;
}

gg.setSemesters = function(){
    var promise = new Promise(function(resolve,reject){
      var currRow = gg.startMarker;
      var foundSemester = false;
      while(currRow && currRow.nextElementSibling !== gg.endMarker)
      {
          if(currRow.innerText.match(/winter/i)
             || currRow.innerText.match(/fall/i)
             ||currRow.innerText.match(/summer/i)
             && currRow !== gg.startMarker)
          {
               //&nbsp causes problems when selecting using attribute. Removing it using whitespace regex
              var _sem = currRow.innerText.split(/\s/);
              var sem = _sem.join("_");
              currRow.setAttribute("gg-semester",sem);
              currRow.classList.add("gg-sem");
          }
          currRow = currRow.nextElementSibling;
      }
      resolve();
  });
  return promise;
}

gg.parseCourses = function(){
  var promise = new Promise(function(resolve,reject){
    //find all the tags that have been given a gg-semester attribute
    var semesters = document.querySelectorAll("tr[gg-semester]");
    if(!semesters)
    {
      alert("Seems like you don't have any courses coming up. This extension won't help you.");
      return;
    }
    gg.courses = [];
    for(var index = 0; index < semesters.length; index++){
        //get the courses and fill the courses array.
        var currentSem = semesters[index];
        (function(curr,courses){
            var original = curr;
          //while the next element sibling doesn't have a gg-semester attribute, keep getting courses for the current semester
          //when the element with gg-semester is reached, break out of the while loop and change the semester
            while(curr.nextElementSibling
              && !curr.nextElementSibling.hasAttribute("gg-semester"))
            {
                var row = curr;
                var course = {};
                if(row.innerText.startsWith("RW"))
                {
                    row = row.innerText.replace(/ /g,"_").trim(); //replace spaces in names with underscore
                    row = row.split(/\s/); //split by spaces and remove RW
                    course.credits = row.pop();
                    course.name = row.pop().replace(/[_]/g," ");
                    course.section = row.pop();
                    course.courseCode = row.pop().replace("_"," ");
                    course.semester = original.getAttribute("gg-semester").replace("_"," ");
                    courses.push(course);
                }
                curr = curr.nextElementSibling;
            }
        })(currentSem,gg.courses)
    }
    resolve();
  })
  return promise;
}

gg.loadPartial = function(){
  var promise = new Promise(function(resolve,reject){
    var ggContainer = document.createElement("div");
    ggContainer.setAttribute("id","gg");
    ggContainer.classList.add("minimize");
    document.body.appendChild(ggContainer);
    //I think this is pretty bad but couldn't figure out templating because I suck
    chrome.runtime.sendMessage({message:"LOAD"});
    //should add types to messages incase I need to store data in localStorage
    chrome.runtime.onMessage.addListener(function(msg,sender,sendResp){
      if(msg.message !== "")
        resolve(msg.message);
    });
  });
  return promise;
}

gg.populateWithCourses = function(msg){
  //append the row container to the GUI and load the rows after filling in the course information
  var ggContainer = document.querySelector("div#gg");
  ggContainer.innerHTML = msg;
  //initialize both types of GPA to current cGPA value
  ggContainer.querySelector(".gg-gpa #cgpa").innerHTML = gg.transcript.cumGPA;
  ggContainer.querySelector(".gg-gpa #pgpa").innerHTML = gg.transcript.cumGPA;
  var rowTemplate =
        "<div class=\"gg-divider\"></div>"
        +"<div class=\"gg-grade\">"
          +"<select class=\"gg-select\">"
            +"<option value=\"--\">&#45;&#45;</option>"
            +"<option value=\"4.0\">A</option>"
            +"<option value=\"3.7\">A-</option>"
            +"<option value=\"3.3\">B+</option>"
            +"<option value=\"3.0\">B</option>"
            +"<option value=\"2.7\">B-</option>"
            +"<option value=\"2.3\">C+</option>"
            +"<option value=\"2.0\">C</option>"
            +"<option value=\"1.0\">D</option>"
            +"<option value=\"0\">F</option>"
          +"</select>"
        +"</div>";
  //create row, set class info values, set credits attribute on .gg-class-info
  for(var index = 0; index < gg.courses.length; index++)
  {
    var row = document.createElement("div");
    row.setAttribute("class","gg-row");
    row.innerHTML = rowTemplate;
    ggContainer.querySelector("div.gg-row-container").appendChild(row);

    var className = document.createElement("div");
    className.setAttribute("class","gg-class-name");
    className.innerHTML = gg.courses[index].name;

    var classCode = document.createElement("div");
    classCode.setAttribute("class","gg-class-code");
    classCode.innerHTML = gg.courses[index].courseCode;

    var classSem = document.createElement("div");
    classSem.setAttribute("class","gg-class-sem");
    classSem.innerHTML = gg.courses[index].semester;

    var classInfo = document.createElement("div");
    classInfo.setAttribute("class","gg-class-info");
    classInfo.appendChild(className);
    classInfo.appendChild(classCode);
    classInfo.appendChild(classSem);

    row.setAttribute("credits",gg.courses[index].credits);
    var divider = row.querySelector("div.gg-divider");
    row.insertBefore(classInfo,divider);

    var logo = document.querySelector(".gg-logo #bordr");
  }
  //add listener to select tags
  var _selectEls = document.querySelectorAll(".gg-select");
  var selectEls = Array.prototype.slice.call(_selectEls);
  for(var index = 0; index < selectEls.length; index++)
  {
    (function(i){
      selectEls[i].addEventListener("change",function(e){
        var grandParent = e.target.parentElement.parentElement;
        var credits = grandParent.getAttribute("credits");
        var courseName = grandParent.querySelector(".gg-class-info").firstElementChild.innerText;
        gg.updatePGPA(credits,e.target.value,courseName);
      });
    })(index);
  }

  logo.addEventListener("click",function(e){
    var el = e.target.parentElement;
    var ggContainer = document.querySelector("div#gg");
    var ggRowContainer = document.querySelector("div.gg-row-container");
    if(!gg.minimized)
    {
      ggContainer.classList.add("minimize");
      ggRowContainer.classList.add("minimize");
      while(el.nextElementSibling)
      {
        el.nextElementSibling.classList.add("minimize");
        el = el.nextElementSibling;
      }
      gg.minimized = true;
    }
    else
    {
      ggRowContainer.classList.remove("minimize");
      ggContainer.classList.remove("minimize");
      while(el.nextElementSibling)
      {
        el.nextElementSibling.classList.remove("minimize");
        el = el.nextElementSibling;
      }
      gg.minimized = false;
    }
  });
}

gg.updatePGPA = function(courseCredits,grade,course)
{
  var courseCredits = parseFloat(courseCredits);
  var grade = parseFloat(grade);
  gg.transcript.points = parseFloat(gg.transcript.points);
  gg.transcript.gpaCreds = parseFloat(gg.transcript.gpaCreds);
  var pGPA = Number();
  var pGPAContainer = document.querySelector(".gg-gpa #pgpa");
  //when updating pGPA, want to subtract previous contribution
  //to points and add new contribution
  //if '--' is passed just subtract previous contribution
  var projectedPoints = gg.transcript.points.toFixed(2);
  var projectedGPACreds = gg.transcript.gpaCreds;
  //hash for lookup of selected grades
  if(!gg.projectedGrades)
    gg.projectedGrades = {};
  //initialize the course if a grade has not been assigned prior
  if(!gg.projectedGrades[course])
  {
    gg.projectedGrades[course] = {};
    gg.projectedGrades[course].gradeValue = null;
    gg.projectedGrades[course].credits = courseCredits;
  }
  //if this value '--' is received, remove the previous courses grade contribution from the total
  if(isNaN(grade))
  {
//    console.log("[*Previous]","Course:",course," Grade:",gg.projectedGrades[course].gradeValue," Points:",gg.transcript.points," GPA Credits: ",gg.transcript.gpaCreds);
    var courseContribution = gg.projectedGrades[course].gradeValue * gg.projectedGrades[course].credits;
    gg.transcript.points -= courseContribution;
    gg.transcript.gpaCreds -= gg.projectedGrades[course].credits;
    pGPA = ((gg.transcript.points/gg.transcript.gpaCreds) - 0.01).toFixed(2) ;//subtracting 0.01 b/c js rounds up but that is not wanted since McGill rounds down
    pGPAContainer.innerHTML = pGPA;
    gg.projectedGrades[course].gradeValue = grade;
//    console.log("[*New]","Course:",course," Grade:",grade," Points:",gg.transcript.points," GPA Credits: ",gg.transcript.gpaCreds);
  }

  else
  {
//    console.log("[Previous]","Course:",course," Grade:",gg.projectedGrades[course].gradeValue," Points:",gg.transcript.points," GPA Credits: ",gg.transcript.gpaCreds);
    if(typeof gg.projectedGrades[course].gradeValue === 'number'
       && gg.projectedGrades[course].gradeValue >= 0)
    {
      //if the course had a previous grade then remove that contribution
      var courseContribution = gg.projectedGrades[course].gradeValue * gg.projectedGrades[course].credits;
    gg.transcript.points -= courseContribution;
    gg.transcript.gpaCreds -= gg.projectedGrades[course].credits;
    }
    gg.projectedGrades[course].gradeValue = grade;
    gg.transcript.points += parseFloat(gg.projectedGrades[course].gradeValue * gg.projectedGrades[course].credits);
    gg.transcript.gpaCreds += gg.projectedGrades[course].credits;
    pGPA = ((gg.transcript.points/gg.transcript.gpaCreds) - 0.01).toFixed(2); //subtracting 0.01 b/c js rounds up but that is not wanted since McGill rounds down
    pGPAContainer.innerHTML = pGPA;
//    console.log("[New]","Course:",course," Grade:",grade," Points:",gg.transcript.points," GPA Credits: ",gg.transcript.gpaCreds);
  }
}
